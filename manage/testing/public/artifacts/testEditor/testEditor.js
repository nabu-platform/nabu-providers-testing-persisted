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
			showAutomation: false,
			steps: [],
			// the variables for this script (order matters for matrix!)
			// for simplicity (of filling it in manually) and matrix testing, all variables should be simple types
			// "name", "type", "default"
			variables: [],
			serviceDefinitions: {},
			// centralized selenium definitions to reuse
			seleniumDefinitions: {},
			// centralized glue definitions to reuse
			glueDefinitions: {},
			showGlue: false,
			showConfiguration: false,
			results: [],
			// the paging of the result sets
			resultPaging: {},
			testCase: null,
			// when running manually, store results here
			manual: null,
			manualStart: null,
			showAllServices: false,
			configurationTab: "editor",
			matrix: [],
			editingResult: null,
			editingStep: null,
			// when editing the step definition in the tree
			editingStepDefinition: null,
			editingStepContent: {},
			editingAttachments: [],
			videoContent: null,
			imageContent: null,
			seleniumContent: null
		}
	},
	computed: {
		glue: function() {
			return this.buildGlue();
		},
		visibleSteps: function() {
			var self = this;
			return this.steps.filter(function(step, index) {
				var visible = true;
				var depth = step.depth;
				// we need to check the first parent with a lower depth to see if it is expanded or not
				while (index > 0) {
					index--;
					// all parent steps must be expanded!
					// note that sibling parents are not important which is why we alter the depth
					if (self.steps[index].depth < depth) {
						visible &= self.steps[index].expanded;
						depth = self.steps[index].depth;
					}
				}
				return visible;
			});
		}
	},
	activate: function(done) {
		this.load().then(done, done);
	},
	methods: {
		variableUsed: function(variable) {
			var used = false;
			this.steps.forEach(function(step) {
				console.log("checking step", step);
				Object.values(step.inputBindingsObject).forEach(function(value) {
					if (value.indexOf("variables." + variable.name + ".") == 0 || value == "variables." + variable.name) {
						used = true;
					}
				})
			});
			return used;
		},
		isVisibleStep: function(step) {
			var visible = true;
			var depth = step.depth;
			var index = this.steps.indexOf(step);
			// we need to check the first parent with a lower depth to see if it is expanded or not
			while (index > 0) {
				index--;
				// all parent steps must be expanded!
				// note that sibling parents are not important which is why we alter the depth
				if (this.steps[index].depth < depth) {
					visible &= this.steps[index].expanded;
					depth = this.steps[index].depth;
				}
			}
			return visible;
		},
		hasRecording: function(result) {
			var hasVideo = result.attachments && result.attachments.filter(function(x) {
				return x.name == "selenium-screen-recording.mp4";
			}).length > 0;
			// if we don't have an actual video, check if we have screenshots
			if (!hasVideo) {
				hasVideo = result.attachments && result.attachments.filter(function(attachment) {
					return attachment.name.indexOf("selenium-screenshot-") == 0;
				}).length > 0;
			}
			return hasVideo;
		},
		showRecording: function(result) {
			var self = this;
			// check if we have an actual video
			var attachment = result.attachments && result.attachments.filter(function(x) {
				return x.name == "selenium-screen-recording.mp4";
			})[0];
			if (attachment) {
				var reader = new FileReader();
				reader.readAsDataURL(attachment.content); 
				reader.onloadend = function() {
					var base64data = reader.result;                
					Vue.set(self, "videoContent", {
						name: attachment.name,
						contentType: attachment.contentType,
						url: 'data:video/mp4;base64,' + base64data.replace(/.*?;base64,/, "")
					});
				}
			}
			// otherwise, we want to build a selenium viewer
			else {
				var screenshots = result.attachments && result.attachments.filter(function(attachment) {
					return attachment.name.indexOf("selenium-screenshot-") == 0;
				});
				if (screenshots.length) {
					var scripts = this.steps.map(function(step) {
						if (step.enabled) {
							if (step.scriptType == "selenium-script" && step.script) {
								return step.script;
							}
							else if (step.scriptType == "selenium-utility" && step.script) {
								var definition = self.seleniumDefinitions[step.script];
								return definition ? definition.script : null;
							}
						}
					});
					var steps = [];
					scripts.forEach(function(script) {
						if (script) {
							var parsed = JSON.parse(script);
							parsed.tests.forEach(function(test) {
								if (test && test.commands) {
									nabu.utils.arrays.merge(steps, test.commands);
								}
							})
						}
					});
					Vue.set(this, "seleniumContent", {
						screenshots: screenshots,
						steps: steps
					});
				}
			}
		},
		showAttachment: function(attachment) {
			var self = this;
			if (attachment.content) {
				var reader = new FileReader();
				reader.readAsDataURL(attachment.content); 
				reader.onloadend = function() {
					var base64data = reader.result;                
					Vue.set(self, "imageContent", {
						name: attachment.name,
						contentType: attachment.contentType,
						url: 'data:application/octet-stream;base64,' + base64data.replace(/.*?;base64,/, "")
					});
				}
			}
			else {
				this.$services.user.downloadUrl("nabu.providers.testing.persisted.manage.rest.testCase.attachment.stream", {attachmentId: attachment.id}, true).then(function(url) {
					Vue.set(self, "imageContent", {
						name: attachment.name,
						contentType: attachment.contentType,
						url: url
					});	
				})
				/*
				Vue.set(self, "imageContent", {
					name: attachment.name,
					contentType: attachment.contentType,
					url: self.$services.swagger.parameters("nabu.providers.testing.persisted.manage.rest.testCase.attachment.stream", {attachmentId: attachment.id}).url
				});
				*/
			}
		},
		isCurrentManualStep: function(result, step) {
			if (result.steps.length == 0) {
				return this.steps.indexOf(step) == 0;
			}
			// the last step in the result is the one before the currently active step
			var current = result.steps[result.steps.length - 1];
			var currentStep = this.steps.filter(function(x) {
				return x.id == current.testCaseStepId;
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
				
				// asynchronously start loading the instance as well
				promise.then(function() {
					var limit = Math.max(7, self.matrix.length);
					console.log("running instance list!");
					self.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.testCase.instance.list", {testCaseId: self.testCaseId, orderBy: ["started desc"], limit: limit}).then(function(result) {
						if (result && result.results) {
							result.results.forEach(function(single) {
								single.saved = true;
								single.changed = false;
							})
							nabu.utils.arrays.merge(self.results, result.results);
						}
						if (result && result.page) {
							nabu.utils.objects.merge(self.resultPaging, result.page);
						}
					})
				})
				
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
		getAttachmentsFor: function(result, step) {
			if (result.attachments) {
				var stepResult = this.getResult(result, step);
				return result.attachments.filter(function(attachment) {
					return attachment.testCaseInstanceStepId == stepResult.id
						&& attachment.name.indexOf("selenium-screenshot-") != 0;
				});
			}
		},
		getError: function(result, step) {
			if (result.exception) {
				var instance = this.getResult(result, step);	
				// the last step, so likely the cause of the issue
				if (result.steps.indexOf(instance) == result.steps.length - 1) {
					// selenium exception because it can't find an element
					if (result.exception.indexOf("org.openqa.selenium.NoSuchElementException") >= 0 && result.exception.indexOf("Session ID") >= 0) {
						//return result.exception.substring(result.exception.indexOf("org.openqa.selenium.NoSuchElementException"), result.exception.indexOf("Session ID"));
						var exception = result.exception.substring(result.exception.indexOf("org.openqa.selenium.NoSuchElementException")).split("\n")[0];
						return exception.substring(exception.indexOf("Unable to"));
					}
					return result.exception;
				}
			}
		},
		getResult: function(result, step) {
			if (result && result.steps != null) {
				return result.steps.filter(function(x) {
					return x.testCaseStepId == step.id;
				})[0];
			}
		},
		setResult: function(result, step, severity) {
			var now = new Date();
			var stepInstance = {
				id: crypto.randomUUID().replace(/-/g, ""),
				testCaseInstanceId: result.id,
				testCaseStepId: step.id,
				severity: severity,
				started: this.manualStart,
				stopped: now,
				temporary: !step.enabled
			};
			this.editingAttachments.splice(0).forEach(function(attachment) {
				result.attachments.push({
					id: crypto.randomUUID().replace(/-/g, ""),
					content: attachment,
					name: attachment.name,
					testCaseInstanceStepId: stepInstance.id,
					testCaseInstanceId: result.id,
					created: new Date()
				});
			});
			var self = this;
			nabu.utils.objects.merge(stepInstance, this.editingStepContent);
			Object.keys(this.editingStepContent).forEach(function(key) {
				delete self.editingStepContent[key];
			})
			result.steps.push(stepInstance);
			this.manualStart = now;
			var index = this.steps.indexOf(step);
			// if the next step is disabled, automatically resolve it
			if (index < this.steps.length - 1 && !this.steps[index + 1].enabled) {
				this.setResult(result, this.steps[index + 1], "WARNING");
			}
			else if (this.steps.indexOf(step) >= this.steps.length - 1) {
				this.stopManual();
			}
		},
		stopManual: function() {
			var self = this;
			// we remove any inactive steps we added
			var stepsToRemove = this.manual.steps.filter(function(x) { return x.temporary });
			stepsToRemove.forEach(function(x) {
				self.manual.steps.splice(self.manual.steps.indexOf(x), 1);
			})
			this.manual.stopped = new Date();
			this.manual.saved = false;
			this.manual.changed = true;
			this.manual = null;
			this.manualStart = null;
			// make sure if you stopped mid-type that it is gone
			this.editingAttachments.splice(0);
		},
		runManual: function() {
			// expand all
			this.steps.forEach(function(x){
				x.expanded = true;
			});
			this.manual = {
				id: crypto.randomUUID().replace(/-/g, ""),
				testCaseId: this.testCaseId,
				runType: "manual",
				started: new Date(),
				steps: [],
				changed: false,
				saved: false,
				validations: [],
				attachments: []
			};
			this.manualStart = new Date();
			this.results.unshift(this.manual);
		},
		runMatrix: function() {
			this.runScript(true);
		},
		getNextIndex: function() {
			var next = 1.
			this.results.forEach(function(result) {
				if (result.testCaseIndex && result.testCaseIndex >= next) {
					next = result.testCaseIndex + 1;
				}
			});
			return next;
		},
		runUntil: function(step) {
			var index = this.steps.indexOf(step);
			var self = this;
			this.runScript(null, index).then(function(result) {
				if (result.attachments) {
					nabu.utils.arrays.merge(self.manual.attachments, result.attachments.map(function(x) {
						x.testCaseInstanceId = self.manual.id;
						return x;
					}));
				}
				if (result.steps) {
					nabu.utils.arrays.merge(self.manual.steps, result.steps.map(function(x) {
						x.testCaseInstanceId = self.manual.id;
						return x;
					}));
				}
				if (result.validations) {
					nabu.utils.arrays.merge(self.manual.validations, result.validations.map(function(x) {
						x.testCaseInstanceId = self.manual.id;
						return x;
					}));
				}
			});
		},
		runScript: function(matrix, untilIndex) {
			var self = this;
			var promise = this.$services.q.defer();
			this.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.testCase.testRun", { body: { script : this.buildGlue(untilIndex), matrix: matrix ? this.buildMatrix() : null, attachments: this.buildAttachments() }}).then(function(x) {
				if (x && x.results && x.results.length) {
					x.results.forEach(function(result) {
						if (result.log) {
							var lastResult = JSON.parse(result.log);
							lastResult.id = crypto.randomUUID().replace(/-/g, "");
							lastResult.testCaseId = self.testCaseId;
							if (lastResult.steps) {
								lastResult.steps.forEach(function(x) {
									// the json formatter will put the test case step id as the "id" field
									x.testCaseStepId = x.id;
									x.id = crypto.randomUUID().replace(/-/g, "");
									x.testCaseInstanceId = lastResult.id;
								});
							}
							// set it to changed so we can toggle the save
							lastResult.changed = true;
							lastResult.saved = false;
							lastResult.exception = result.exception;
							lastResult.runType = matrix ? "matrixRun" : "quickRun";
							// add the validations
							lastResult.validations = result.validations;
							if (lastResult.validations) {
								// remap attachments
								lastResult.validations.forEach(function(validation) {
									if (validation.id) {
										var step = lastResult.steps.filter(function(step) {
											return step.testCaseStepId == validation.id;
										})[0];
										validation.testCaseInstanceStepId = step ? step.id : null;
									}
									validation.testCaseInstanceId = lastResult.id;
									validation.id = crypto.randomUUID().replace(/-/g, "");
								})
							}
							lastResult.attachments = result.attachments;
							if (lastResult.attachments) {
								// remap attachments
								lastResult.attachments.forEach(function(attachment) {
									if (attachment.executorId) {
										var step = lastResult.steps.filter(function(step) {
											return step.testCaseStepId == attachment.executorId;
										})[0];
										attachment.testCaseInstanceStepId = step ? step.id : null;
									}
									attachment.created = attachment.timestamp;
									attachment.testCaseInstanceId = lastResult.id;
									attachment.id = crypto.randomUUID().replace(/-/g, "");
								})
							}
							// if we do a partial run, we don't want to push the result
							if (!untilIndex) {
								self.results.unshift(lastResult);
							}
							promise.resolve(lastResult);
						}
					})
				}
			}, promise);
			return promise;
		},
		buildMatrix: function() {
			var result = "";
			var self = this;
			this.matrix.forEach(function(record) {
				if (record["$variant"]) {
					result += "@name " + record["$variant"] + "\n";
				}
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
		buildGlue: function(untilIndex) {
			var glue = "\n";
			glue += "# Declare variables\n"
				+ "sequence\n"
			
			this.variables.forEach(function(variable) {
				if (variable.default && variable.default.indexOf("=") == 0) {
					glue += "\t" + variable.name + " ?= " + variable.default.substring(1) + "\n";
				}
				else {
					glue += "\t" + variable.name + " ?= " + (variable.default ? "\"" + variable.default + "\"" : "null") + "\n";
				}
			});
			var self = this;
			var hasSelenium = false;
			this.steps.filter(function(x, index) { return !untilIndex || index <= untilIndex }).filter(function(x) { return x.enabled }).forEach(function(step) {
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
							else if (binding) {
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
				// an embedded selenium script or a utility, they only differ in how the attachments are created
				else if ((step.scriptType == "selenium-script" || step.scriptType == "selenium-utility") && step.script) {
					hasSelenium = true;
					// we assume there will be a script
					glue += "\n@id " + step.id + "\n"
					glue += "selenium.selenese($webdriver, resource('selenium-" + step.id + ".json'))\n"
				}
			})
			if (hasSelenium) {
				// request the selenium recording (if any) to be attached
				glue = "\n$webdriver = selenium.webdriver('chrome')\n" + glue + "\n# Final steps\nsequence\n\tselenium.recording($webdriver)\n";
			}
			return glue;
		},
		buildAttachments: function() {
			var attachments = [];
			var self = this;
			this.steps.filter(function(x) { return x.enabled }).forEach(function(step) {
				if (step.scriptType == "selenium-script" && step.script) {
					var blob = new Blob([step.script], { type : 'application/json' });
					attachments.push({
						name: "selenium-" + step.id + ".json",
						content: blob,
						contentType: "application/json"
					})
				}
				else if (step.scriptType == "selenium-utility" && step.script) {
					var definition = self.seleniumDefinitions[step.script];
					if (definition && definition.script) {
						var blob = new Blob([definition.script], { type : 'application/json' });
						attachments.push({
							name: "selenium-" + step.id + ".json",
							content: blob,
							contentType: "application/json"
						});
					}
				}
			});
			return attachments;
		},
		generateSeleniumInterface: function(step, script) {
			var inputDefinition = null;
			var outputDefinition = null;
			if (script) {
				var variables = script.match(/\$\{[^}]+\}/g);
				if (variables && variables.length) {
					var inputDefinition = {};
					variables.forEach(function(variable) {
						variable = variable.replace(/\$\{([^}]+)\}/, "$1");
						inputDefinition[variable] = {
							type: "string"
						}
					});
				}
				try {
					var parsed = JSON.parse(script);
					if (parsed.tests && parsed.tests.length) {
						parsed.tests.forEach(function(test) {
							outputDefinition = {};
							if (test.commands && test.commands.length) {
								test.commands.forEach(function(command) {
									if (command.command == "storeText" && command.value) {
										outputDefinition[command.value] = {
											type: "string"
										}
									}
								});
							}
						});
					}
				}
				catch (exception) {
					console.error("Could not calculate output", exception, script);
				}
			}
			step.inputDefinition = inputDefinition ? JSON.stringify({properties:inputDefinition}) : null;
			step.outputDefinition = outputDefinition && Object.keys(outputDefinition).length ? JSON.stringify({properties:outputDefinition}) : null;
		},
		deleteResult: function(result) {
			if (result == this.manual) {
				this.stopManual();
			}
			var index = this.results.indexOf(result);	
			if (index >= 0) {
				this.results.splice(index, 1);
			}
			// if we saved it, also delete in backend!
			if (result.saved) {
				// TODO
			}
		},
		saveResult: function(result) {
			var self = this;
			// enrich with index before saving
			if (!result.testCaseIndex) {
				result.testCaseIndex = this.getNextIndex();
			}
			return this.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.testCase.instance.merge", {
				body: result
			}).then(function(x) {
				result.changed = false;
				result.saved = true;
				if (!self.resultPaging.totalRowCount) {
					self.resultPaging.totalRowCount = 1;
				}
				else {
					self.resultPaging.totalRowCount++;
				}
			});
		},
		editResult: function(result) {
			Vue.set(this, "editingResult", result);	
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
			// whether or not the step is expanded (defaults to true)
			Vue.set(step, "expanded", true);
			//Vue.set(step, "outputBindingsObject", step.outputBindings ? JSON.parse(step.outputBindings) : {});
			return step;
		},
		postprocess: function(step) {
			step.lineNumber = this.steps.indexOf(step);
			step.inputBindings = step.inputBindingsObject ? JSON.stringify(step.inputBindingsObject) : null;
			//step.outputBindings = step.outputBindingsObject ? JSON.stringify(step.outputBindingsObject) : null;
			return step;
		},
		updateService: function(step, service, type) {
			type = type.toLowerCase().replace(/[\s]+/g, "-");
			Vue.set(step, "scriptType", type);	
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
		suggestServices: function(value, label) {
			console.log("suggesting from", label);
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
				scriptType: null,
				inputBindings: "{}",
				outputBindings: null,
				inputDefinition: null,
				outputDefinition: null,
				testCaseId: this.testCaseId,
				enabled: true
			});
		},
		addAfter: function(index) {
			// always set to expanded if you add something!
			this.steps[index].expanded = true;
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
		moveVariable: function(variable, amount) {
			var index = this.variables.indexOf(variable);
			var newIndex = index + amount;
			if (newIndex < 0) {
				newIndex = 0;
			}
			else if (newIndex >= this.variables.length - 1) {
				newIndex = this.variables.length - 1;
			}
			this.variables.splice(index, 1);
			this.variables.splice(newIndex, 0, variable);
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
		},
		"editingResult": {
			deep: true,
			handler: function(newValue, oldValue) {
				// if we have an oldvalue, we are not just assigning it but updating it
				if (oldValue && newValue != this.manual) {
					newValue.changed = true;
				}
			}
		}
	}
});


Vue.component("test-selenium-viewer", {
	template: "#test-selenium-viewer",
	props: {
		// the attachments we captured
		screenshots: {
			type: Array
		},
		// the selenium steps
		steps: {
			type: Array
		}
	},
	data: function() {
		return {
			// play speed
			speed: 1,
			paused: true,
			currentFrame: -1,
			imageLoadStart: null,
			loaded: false,
			timer: 0,
			timerResult: null
		}
	},
	computed: {
		currentStep: function() {
			if (this.currentFrame >= 0) {
				var frame = this.frames[this.currentFrame];
				return this.steps.filter(function(x) {
					return x.id == frame.stepId;
				})[0];
			}
		},
		// calculate the frames
		frames: function() {
			var self = this;
			// establish frames first
			// a frame is a visual change
			var frames = [];
			var promises = [];
			this.steps.forEach(function(step) {
				var screenshots = self.screenshots.filter(function(x) {
					return x.name.indexOf("selenium-screenshot-" + step.id + "-") == 0;
				});
				var before = screenshots.filter(function(x) {
					return x.name.indexOf("before") >= 0;
				})[0];
				var after = screenshots.filter(function(x) {
					return x.name.indexOf("after") >= 0;
				})[0];
				
				step.started = before ? before.created : null;
				step.stopped = after ? after.created : null;
				
				if (before) {
					var beforeFrame = {};
					beforeFrame.type = "before";
					beforeFrame.stepId = step.id;
					beforeFrame.timestamp = before.created;
					if (before.content) {
						var beforePromise = self.$services.q.defer();
						var beforeReader = new FileReader();
						beforeReader.readAsDataURL(before.content); 
						beforeReader.onloadend = function() {
							var base64data = beforeReader.result;    
							Vue.set(beforeFrame, "url", base64data);
							beforePromise.resolve();
						}
						promises.push(beforePromise);
					}
					else {
						promises.push(self.$services.user.downloadUrl("nabu.providers.testing.persisted.manage.rest.testCase.attachment.stream", {attachmentId: before.id}, true).then(function(url) {
							beforeFrame.url = url;
						}));
						//beforeFrame.url = self.$services.swagger.parameters("nabu.providers.testing.persisted.manage.rest.testCase.attachment.stream", {attachmentId: before.id}).url;
					}
					frames.push(beforeFrame);
				}
				if (after) {
					var afterFrame = {};
					afterFrame.type = "after";
					afterFrame.stepId = step.id;
					afterFrame.timestamp = after.created;
					if (after.content) {
						var afterPromise = self.$services.q.defer();
						var afterReader = new FileReader();
						afterReader.readAsDataURL(after.content); 
						afterReader.onloadend = function() {
							var base64data = afterReader.result;    
							Vue.set(afterFrame, "url", base64data);
							afterPromise.resolve();
						}
						promises.push(afterPromise);
					}
					else {
						promises.push(self.$services.user.downloadUrl("nabu.providers.testing.persisted.manage.rest.testCase.attachment.stream", {attachmentId: after.id}, true).then(function(url) {
							afterFrame.url = url;
						}));
						//afterFrame.url = self.$services.swagger.parameters("nabu.providers.testing.persisted.manage.rest.testCase.attachment.stream", {attachmentId: after.id}).url;
					}
					frames.push(afterFrame);
				}
			});
			// we need to calculate the duration
			frames.forEach(function(frame, index) {
				console.log("calculating from", frame.timestamp);
				if (frame.timestamp) {
					if (index < frames.length - 1) {
						frame.duration = frames[index + 1].timestamp.getTime() - frame.timestamp.getTime();
					}
				}
				// set a default duration of 500ms
				if (!frame.duration) {
					frame.duration = 500;
				}
			});
			this.$services.q.all(promises).then(function(x) {
				self.loaded = true;
			});
			return frames;
		}
	},
	ready: function() {
		this.startPlay();
	},
	methods: {
		imageLoaded: function() {
			if (this.imageLoadStart) {
				console.log("image loaded", (new Date().getTime() - this.imageLoadStart.getTime()) + "ms");
			}
			// if we are not paused, we wait for the frame timeout
			if (!this.paused && this.frames[this.currentFrame].url.indexOf("data:") != 0) {
				this.waitAndPlay();
			}
		},
		selectStep: function(step) {
			var firstFrame = this.frames.filter(function(x) {
				return x.stepId == step.id;
			})[0];
			if (firstFrame) {
				this.currentFrame = this.frames.indexOf(firstFrame);
			}
		},
		stop: function() {
			this.paused = true;
			this.currentFrame = 0;
		},
		startPlay: function() {
			if (!this.loaded) {
				setTimeout(this.startPlay, 100);
			}
			else {
				this.paused = false;
				// restart from beginning...
				if (this.currentFrame >= this.frames.length - 1) {
					this.currentFrame = -1;
				}
				this.play();
			}
		},
		getCalculatedStateClass: function(step) {
			var frames = this.frames.filter(function(x) {
				return x.stepId == step.id;
			});
			if (frames.length == 0) {
				return "is-variant-warning-outline";
			}
			// if this step has the last frame, check if there is a next step that should have a frame
			else if (this.frames.indexOf(frames[frames.length - 1]) >= this.frames.length - 1) {
				console.log("checking last frame");
				if (this.steps.indexOf(step) < this.steps.length - 1) {
					return "is-variant-danger-outline";
				}
			}
			return "is-variant-success-outline";
		},
		waitAndPlay: function() {
			// wait for a while to start the next frame
			var timeout = this.frames[this.currentFrame].duration * this.speed;
			setTimeout(this.play, timeout);
			this.timer = timeout;
			this.reduceTimer();
		},
		reduceTimer: function() {
			var self = this;
			var delta = Math.min(100, self.timer);
			if (this.timerResult) {
				clearTimeout(this.timerResult);
			}
			this.timerResult = setTimeout(function() {
				self.timer -= delta;
				if (self.timer > 0) {
					self.reduceTimer();
				}
				else {
					self.timer = 0;
				}
			}, delta);
		},
		play: function() {
			if (!this.paused) {
				if (this.currentFrame < this.frames.length - 1) {
					// move to the next frame
					this.currentFrame++;
				}
				else {
					this.pause();
				}
			}
		},
		pause: function() {
			this.paused = true;
		}
	},
	watch: {
		// for data urls the load is not consistently called
		currentFrame: function(newValue) {
			if (newValue >= 0) {
				if (this.frames[newValue].url.indexOf("data:") == 0 && !this.paused) {
					this.waitAndPlay();
				}
				else {
					this.imageLoadStart = new Date();
				}
			}
		}
	}
})


