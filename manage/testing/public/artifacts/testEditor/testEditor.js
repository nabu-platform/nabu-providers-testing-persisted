Vue.view("test-editor", {
	props: {
		serviceFolder: {
			type: String
		},
		testCaseId: {
			type: String
		}
	},
	data: function() {
		return {
			showAutomation: true,
			steps: [],
			// the variables for this script (order matters for matrix!)
			// for simplicity (of filling it in manually) and matrix testing, all variables should be simple types
			// "name", "type", "default"
			variables: [],
			serviceDefinitions: {},
			showGlue: false,
			showConfiguration: false,
			results: [],
			testCase: null,
			// when running manually, store results here
			manual: null,
			showAllServices: false,
			configurationTab: "variables",
			matrix: []
		}
	},
	computed: {
		glue: function() {
			return this.buildGlue();
		}
	},
	activate: function(done) {
		this.load().then(done, done);
	},
	methods: {
		isCurrentManualStep: function(result, step) {
			if (result.steps.length == 0) {
				return this.steps.indexOf(step) == 0;
			}
			var current = result.steps[result.steps.length - 1];
			var currentStep = this.steps.filter(function(x) {
				return x.id == current.id;
			})[0];
			return this.steps.indexOf(currentStep) == this.steps.indexOf(step) - 1;
		},
		load: function() {
			if (this.testCaseId) {
				var self = this;
				var promise = this.$services.q.defer();
				var promises = [];
				promises.push(this.$services.swagger.execute("nabu.providers.testing.persisted.crud.testCase.services.get", {id: this.testCaseId}).then(function(x) {
					Vue.set(self, "testCase", x);
					if (x.variables) {
						var list = JSON.parse(x.variables);
						if (list && list.length) {
							nabu.utils.arrays.merge(self.variables, list);
						}
					}
					if (x.matrix) {
						var list = JSON.parse(x.matrix);
						if (list && list.length) {
							nabu.utils.arrays.merge(self.matrix, list);
						}
					}
				}));
				promises.push(this.$services.swagger.execute("nabu.providers.testing.persisted.crud.testCaseStep.services.list", {testCaseId: this.testCaseId, orderBy: ["lineNumber"]}).then(function(x) {
					self.steps.splice(0);
					if (x && x.results) {
						x.results.forEach(function(y) {
							self.steps.push(self.preprocess(y));
						})
					}
					if (self.steps.length == 0) {
						self.steps.push(self.newStep());
					}
					self.recalculateTypes();
				}));
				this.$services.q.all(promises).then(function() {
					var serviceIds = [];
					self.steps.filter(function(x) {
						return x.scriptType == "service" && x.script;
					}).forEach(function(x) {
						if (serviceIds.indexOf(x.script) < 0) {
							serviceIds.push(x.script);
						}
					});
					console.log("service ids to load!!", serviceIds);
					if (serviceIds.length) {
						self.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.service.list", {
							serviceIds: serviceIds
						}).then(function(result) {
							console.log("resolved", result);
							if (result && result.results) {
								result.results.forEach(function(x) {
									self.serviceDefinitions[x.id] = x;
								})
							}
							promise.resolve();
						}, promise);
					}
					else {
						promise.resolve();
					}
				}, promise);
				return promise;
			}
			return this.$services.q.reject();
		},
		save: function() {
			var self = this;
			this.steps.forEach(function(step) {
				self.postprocess(step);
			});
			var promises = [];
			promises.push(this.$services.swagger.execute("nabu.providers.testing.persisted.crud.testCase.services.update", {
				id: this.testCaseId,
				body: this.testCase
			}));
			promises.push(this.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.testCase.step.updateAll", {
				testCaseId: this.testCaseId,
				body: {
					steps: this.steps
				}
			}));
			return this.$services.q.all(promises);
		},
		getResult: function(result, step) {
			if (result && result.steps != null) {
				return result.steps.filter(function(x) {
					return x.id == step.id;
				})[0];
			}
		},
		setResult: function(result, step, severity) {
			result.steps.push({
				id: step.id,
				severity: severity
			});
			if (this.steps.indexOf(step) >= this.steps.length - 1) {
				this.stopManual();
			}
		},
		stopManual: function() {
			this.manual.stopped = new Date();
			this.manual = null;
		},
		runManual: function() {
			this.manual = {
				testCaseId: this.testCaseId,
				runType: "manual",
				started: new Date(),
				steps: []
			};
			this.results.unshift(this.manual);
		},
		runMatrix: function() {
			this.runScript(true);
		},
		runScript: function(matrix) {
			var self = this;
			this.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.testCase.testRun", { body: { script : this.buildGlue(), matrix: matrix ? this.buildMatrix() : null }}).then(function(x) {
				if (x && x.results && x.results.length) {
					x.results.forEach(function(result) {
						if (result.log) {
							var lastResult = JSON.parse(x.results[0].log);
							lastResult.runType = matrix ? "matrixRun" : "quickRun";
							self.results.unshift(lastResult);
						}
					})
				}
			});
		},
		buildMatrix: function() {
			var result = "";
			var self = this;
			this.matrix.forEach(function(record) {
				var first = true;
				self.variables.forEach(function(variable) {
					if (first) {
						first = false;
					}
					else {
						result += ",";
					}
					result += record[variable.name] != null ? record[variable.name] : "";
				})
				result += "\n";
			});
			return result.length ? result : null;
		},
		// build the glue service to run
		buildGlue: function() {
			var glue = "\n";
			glue += "# Declare variables\n"
				+ "sequence\n"
			
			this.variables.forEach(function(variable) {
				glue += "\t" + variable.name + " ?= " + (variable.default ? "\"" + variable.default + "\"" : "null") + "\n";
			});
			var self = this;
			this.steps.filter(function(x) { return x.enabled }).forEach(function(step) {
				self.postprocess(step);
				if (step.scriptType == "service" && step.script) {
					glue += "\n@id " + step.id + "\n"
					if (step.outputBindings) {
						glue += step.outputBindings + " = ";
					}
					glue += step.script + "(";
					if (step.inputBindings) {
						var first = true;
						var bindings = JSON.parse(step.inputBindings);
						Object.keys(bindings).forEach(function(key) {
							var binding = bindings[key] ? bindings[key] : null;
							if (binding && binding.indexOf("fixed.") == 0) {
								binding = binding.substring("fixed/".length);
								// check for native types
								if (binding != "true" && binding != "false" && binding != "null" && !binding.match(/^[0-9.]+$/)) {
									binding = "\"" + binding + "\"";
								}
							}
							else if (binding && binding.indexOf("variables.") == 0) {
								binding = binding.substring("variables/".length).replace(/\./g, "/");
							}
							else {
								binding = binding.replace(/\./g, "/");
							}
							if (binding) {
								if (first) {
									first = false;
								}
								else {
									glue += ", "
								}
								glue += key + ": " + binding;
							}
						});
					}
					glue += ")\n";
				}
				else if (step.scriptType == "glue" && step.script) {
					glue += "\n@id " + step.id + "\n"
						+ "sequence\n"
					glue += step.script.replace(/^/mg, "\t") + "\n";
				}
			})
			return glue;
		},
		serviceFormatter: function(service) {
			var html = "<div class='is-column is-spacing-gap-small'>";
			html += "<span>" + (service.summary ? service.summary : service.id) + "</span>";
			if (service.description) {
				html += "<span class='is-content is-variant-subscript'>" + service.description + "</span>"
			}
			if (service.tags) {
				html += "<div class='is-row is-spacing-gap-small'>";
				service.tags.forEach(function(tag) {
					html += "<span class='is-badge'>" + tag + "</span>";
				});
				html += "</div>";
			}
			return html;
		},
		preprocess: function(step) {
			Vue.set(step, "inputBindingsObject", step.inputBindings ? JSON.parse(step.inputBindings) : {});
			Vue.set(step, "show", false);
			//Vue.set(step, "outputBindingsObject", step.outputBindings ? JSON.parse(step.outputBindings) : {});
			return step;
		},
		postprocess: function(step) {
			step.lineNumber = this.steps.indexOf(step);
			step.inputBindings = step.inputBindingsObject ? JSON.stringify(step.inputBindingsObject) : null;
			//step.outputBindings = step.outputBindingsObject ? JSON.stringify(step.outputBindingsObject) : null;
			return step;
		},
		updateService: function(step, service) {
			Vue.set(step, "script", service ? service.id : null);
			Vue.set(step, "inputDefinition", service ? service.inputDefinition : null);
			Vue.set(step, "outputDefinition", service ? service.outputDefinition : null);
		},
		getServiceInformation: function(service) {
			return this.serviceDefinitions[service];	
		},
		resolveService: function(service) {
			console.log("resolving", service, this.serviceDefinitions[service]);
			return this.serviceDefinitions[service];	
		},
		suggestServices: function(value) {
			var self = this;
			return this.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.service.list", {
				folderId: this.showAllServices ? null : (this.testCase && this.testCase.utilityFolderId ? this.testCase.utilityFolderId : this.serviceFolder),
				q: value, 
				limit: 20, 
				offset: 0, 
				orderBy: ["id"]
			}).then(function(result) {
				if (result && result.results) {
					result.results.forEach(function(x) {
						self.serviceDefinitions[x.id] == x;
					})
				}
			});
		},
		validateVariableName: function(name) {
			var messages = [];
			if (name && !name.match(/^[\w]+$/)) {
				messages.push({
					severity: "error",
					code: "invalid",
					title: "The variable name must be camelCase"
				})
			}
			return messages;
		},
		// returns the pipeline that exists at that step
		getPipeline: function(step) {
			var index = this.steps.indexOf(step);
			var variables = {};
			this.variables.forEach(function(x) {
				variables[x.name] = {
					type: "string"
				}
			});
			var pipeline = {
				variables: {properties: variables}
			}
			this.steps.slice(0, index).forEach(function(step) {
				// if we have an output definition, we will be injecting new data
				if (step.outputDefinition && step.outputBindings) {
					pipeline[step.outputBindings] = JSON.parse(step.outputDefinition);
				}
			});
			return pipeline;
		},
		getInputBindings: function(step) {
			return step.inputBindings ? JSON.parse(step.inputBindings) : {};
		},
		setInputBindings: function(step, value) {
			step.inputBindings = value ? JSON.stringify(value) : null;
		},
		getInputDefinition: function(step) {
			return step.inputDefinition ? JSON.parse(step.inputDefinition) : {};
		},
		getOutputDefinition: function(step) {
			var result = {};
			if (step.outputDefinition) {
				nabu.utils.objects.merge(result, JSON.parse(step.outputDefinition));
			}
			return result;
		},
		formatLineNumber: function(index) {
			index++;
			if (index < 10) {
				index = "000" + index;
			}
			else if (index < 100) {
				index = "00" + index;
			}
			else if (index < 1000) {
				index = "0" + index;
			}
			return index;
		},
		newStep: function() {
			return this.preprocess({
				description: "",
				automate: false,
				script: "",
				id: crypto.randomUUID().replace(/-/g, ""),
				depth: 0,
				// types are "step" and "title"
				type: "step",
				scriptType: "service",
				inputBindings: "{}",
				outputBindings: null,
				inputDefinition: null,
				outputDefinition: null,
				testCaseId: this.testCaseId,
				enabled: true
			});
		},
		addAfter: function(index) {
			var step = this.newStep();
			step.depth = this.steps[index].depth;
			this.steps.splice(index + 1, 0, step);
			this.focus(index + 1);
		},
		update: function(step, $event) {
			var content = $event.target.innerHTML;
			var current = step.description;
			if (content != current) {
				step.description = content;
			}
		},
		recalculateTypes: function() {
			for (var i = 0; i < this.steps.length - 1; i++)	 {
				this.steps[i].type = this.steps[i + 1].depth > this.steps[i].depth ? "title" : "step";
				// disable automation on titles (?)
				if (this.steps[i].type == "title") {
					this.steps[i].automate = false;
				}
			}
			if (this.steps.length > 0) {
				this.steps[this.steps.length - 1].type = "step";
			}
		},
		tab: function(step, $event) {
			if ($event.shiftKey) {
				if (step.depth > 0) {
					step.depth--;
				}
			}
			else {
				step.depth++;
			}
			// changing the depth of a step might affect the previous step
			var index = this.steps.indexOf(step);
			this.recalculateTypes();
			/*
			if (index > 0) {
				var previous = this.steps[index - 1];
				if (previous.depth < step.depth) {
					previous.type = "title";
				}
				else {
					previous.type = "step";
				}
			}
			*/
			$event.preventDefault();
			this.focus(index);
		},
		closeOther: function(step) {
			this.steps.forEach(function(single) {
				if (single != step) {
					single.show = false;
				}
			})	
		},
		paste: function(step, $event) {
			console.log("pasted content");
		},
		focus: function(index) {
			var self = this;
			Vue.nextTick(function() {
				setTimeout(function() {
					var step = self.steps[index];
					self.$refs.editors.forEach(function(editor) {
						if (editor.getAttribute("step-id") == step.id) {
							editor.focus();
						}
					})
					//self.$refs.editors[index].focus();
				}, 25);
			})
		},
		remove: function(step) {
			var index = this.steps.indexOf(step);
			if (index >= 0) {
				this.steps.splice(index, 1);
			}
		},
		move: function(step, amount) {
			var index = this.steps.indexOf(step);
			var newIndex = index + amount;
			if (newIndex < 0) {
				newIndex = 0;
			}
			else if (newIndex >= this.steps.length - 1) {
				newIndex = this.steps.length - 1;
			}
			// remove step
			this.steps.splice(index, 1);
			this.steps.splice(newIndex, 0, step);
			this.recalculateTypes();
			this.focus(newIndex);
		},
		shift: function(step, amount) {
			var index = this.steps.indexOf(step);
			var newIndex = index + amount;
			if (newIndex < 0) {
				newIndex = 0;
			}
			else if (newIndex >= this.steps.length - 1) {
				newIndex = this.steps.length - 1;
			}
			this.recalculateTypes();
			this.focus(newIndex);
		},
		resizeText: function(step, $event) {
			var lines = Math.max(1, step.script.split(/\n/).length);
			this.$refs.automationEditors.forEach(function(editor) {
				if (editor.getAttribute("step-id") == step.id) {
					editor.style.minHeight = lines + "rem";
				}
			})
		}
	},
	watch: {
		"variables": {
			deep: true,
			handler: function(newValue) {
				this.testCase.variables = JSON.stringify(newValue);
			}
		},
		"matrix": {
			deep: true,
			handler: function(newValue) {
				this.testCase.matrix = JSON.stringify(newValue);
			}
		}
	}
});