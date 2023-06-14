Vue.view("test-editor", {
	props: {
		serviceFolder: {
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
			serviceDefinitions: {}
		}
	},
	ready: function() {
		// temporary
		this.variables.push({name: "test"});
		// -temporary
		
		if (this.steps.length == 0) {
			this.steps.push(this.newStep());
		}
		var serviceIds = this.steps.filter(function(x) {
			return x.scriptType == "service" && x.script;
		}).map(function(x) {
			return x.script;
		});
		if (serviceIds.length) {
			var self = this;
			this.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.service.list", {
				serviceIds: serviceIds	
			}).then(function(result) {
				if (result && result.results) {
					result.results.forEach(function(x) {
						self.serviceDefinitions[x.id] == x;
					})
				}	
			});
		}
	},
	methods: {
		updateService: function(step, service) {
			Vue.set(step, "script", service ? service.id : null);
			Vue.set(step, "inputDefinition", service ? service.inputDefinition : null);
			Vue.set(step, "outputDefinition", service ? service.outputDefinition : null);
			console.log("service is", service);
		},
		suggestServices: function(value) {
			return this.$services.swagger.execute("nabu.providers.testing.persisted.manage.rest.service.list", {
				folderId: this.serviceFolder,
				q: value, 
				limit: 20, 
				offset: 0, 
				orderBy: ["id"]
			});
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
				if (step.automate && step.outputDefinition && step.outputBinding) {
					pipeline[step.outputBinding] = JSON.parse(step.outputDefinition);
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
			return {
				description: "",
				automate: false,
				script: "",
				id: crypto.randomUUID().replace(/-/g, ""),
				depth: 0,
				// types are "step" and "title"
				type: "step",
				scriptType: "service"
			}
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
	}
});