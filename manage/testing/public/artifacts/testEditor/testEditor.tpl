<template id="test-editor">
	<div class="is-column is-spacing-gap-medium is-test-editor">
		<div class="is-row">
			<button @click="configurationTab = 'editor'" class="is-button is-variant-tab" :class="{'is-active': configurationTab == 'editor'}">Editor</button>
			<button @click="configurationTab = 'matrix'" class="is-button is-variant-tab" :class="{'is-active': configurationTab == 'matrix'}">Variables</button>
			<button @click="configurationTab = 'utilities'" class="is-button is-variant-tab" :class="{'is-active': configurationTab == 'utilities'}">Utilities</button>
			<button @click="configurationTab = 'settings'" class="is-button is-variant-tab" :class="{'is-active': configurationTab == 'settings'}">Settings</button>
		</div>
		<n-form class="is-variant-vertical" content-class="is-row is-spacing-small is-spacing-gap-xsmall" v-if="configurationTab == 'variables'">
			<div class="is-row is-spacing-medium is-color-body has-button-close" v-for="(variable, index) in variables">
				<div class="is-column is-align-center">
					<button class="is-button is-variant-ghost is-size-small" @click="moveVariable(variable, -1)"><icon name="chevron-up"/></button>
					<button class="is-button is-variant-ghost is-size-small" @click="moveVariable(variable, 1)"><icon name="chevron-down"/></button>
				</div>
				<button class="is-button is-size-small is-variant-close" @click="variables.splice(index, 1)"><icon name="times"/></button>
				<n-form-text v-model="variable.name" label="Name" after="Note that you must use camelCase naming convention for the variable name."/>
				<n-form-text v-model="variable.default" label="Default value"/>
			</div>
			<div class="is-row is-align-end">
				<button class="is-button is-variant-primary-outline is-size-xsmall" @click="variables.push({})"><icon name="plus"/><span class="is-text">Variable</span></button>
			</div>
		</n-form>
		<n-form content-class="is-column is-spacing-medium" class="is-variant-vertical" v-else-if="configurationTab == 'settings'">
			<n-form-text v-model="testCase.title" label="Title"/>
			<n-form-text v-model="testCase.utilityFolderId" label="Utility Folder Id"/>
			<n-form-text v-model="testCase.serviceContext" label="Service Context"/>
			<n-form-text v-model="testCase.description" type="area" label="Description"/>
		</n-form>
		<n-form class="is-variant-horizontal is-matrix" content-class="is-column is-spacing-small" v-else-if="configurationTab == 'matrix'">
			<div class="is-row is-spacing-gap-small" v-if="false">
				<div class="is-tag" v-for="(variable, index) in variables">
					<span class="is-text">
						<span class="is-text-value is-decoration-emphasis">{{variable.name}}</span>
						<span class="is-text-subscript">{{variable.default}}</span>
					</span>
					<icon name="pencil-alt" @click.native="editVariable = variable"/>
					<icon name="times" @click.native="variables.splice(index, 1)"/>
				</div>
			</div>
			<table class="is-table">
				<thead>
					<tr>
						<th class="is-border-none"></th>
						<th v-for="(variable, variableIndex) in variables"><div class="is-row is-wrap-none is-align-center"><div class="is-row is-spacing-gap-small" v-if="!variableUsed(variable)"><n-form-text v-model="variable.name" placeholder="camelCase variable name" /><button class="is-button is-variant-ghost is-size-xsmall" @click="variables.splice(variableIndex)"><icon name="times"/></button></div><span v-else>{{variable.name}}</span>
							<button class="is-button is-variant-ghost is-size-xxsmall" @click="moveVariable(variable, -1)"><icon name="chevron-left"/></button>
							<button class="is-button is-variant-ghost is-size-xxsmall" @click="moveVariable(variable, 1)"><icon name="chevron-right"/></button>
						</div></th>
						<th><button class="is-button is-variant-ghost is-size-xsmall" @click="variables.push({})"><icon name="plus"/></button></th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class="is-border-none">Default values</td>
						<td v-for="variable in variables"><n-form-text v-model="variable.default" placeholder="Set a default value"/></td>
						<td></td>
					</tr>
					<tr v-for="(record, index) in matrix">
						<td class="is-border-none"><n-form-text v-model="record['$variant']" label="Variant"/></td>
						<td v-for="variable in variables"><n-form-text v-model="record[variable.name]" :placeholder="variable.default"/></td>
						<td><button class="is-button is-size-xsmall is-variant-ghost" @click="matrix.splice(index, 1)"><icon name="times" class="is-variant-danger-outline"/></button></td>
					</tr>
				</tbody>
			</table>
			<div class="is-row is-align-end">
				<button class="is-button is-variant-primary-outline is-size-xsmall" @click="matrix.push({})"><icon name="plus"/><span class="is-text">Variant</span></button>
			</div>
		</n-form>
		<div class="is-column is-spacing-gap-medium" v-else-if="configurationTab == 'utilities'">
			<n-collapsible title="Selenium utilities" :start-open="true" :only-one-open="true" content-class="is-spacing-medium">
				<div class="is-row is-pattern-basic-alternating is-spacing-gap-medium is-align-start">
					<n-form class="is-variant-vertical" content-class="is-column is-spacing-medium is-shadow-xsmall has-button-close" v-for="template in getTemplates('selenium-utility')">
						<button class="is-button is-size-small is-variant-close" @click="deleteTemplate(template)"><icon name="times"/></button>
						<n-form-text v-model="template.title" label="Title" :timeout="600" @input="saveTemplate(template)"/>
						<n-form-text type="area" v-model="template.script" label="Selenium script" :timeout="600" @input="function(script) { generateSeleniumInterface(template, script); saveTemplate(template) }"/>
						<div class="is-row is-spacing-gap-small" v-if="getInputVariables(template).length"><span class="is-content is-size-small">Inputs:</span><span class="is-badge" v-for="variable in getInputVariables(template)">{{variable}}</span></div>
						<div class="is-row is-spacing-gap-small" v-if="getOutputVariables(template).length"><span class="is-content is-size-small">Outputs:</span><span class="is-badge" v-for="variable in getOutputVariables(template)">{{variable}}</span></div>
					</n-form>
				</div>
				<div class="is-row">
					<button class="is-button is-variant-primary-outline is-size-small" @click="newTemplate('selenium-utility')"><icon name="plus"/><span class="is-text">Selenium utility</span></button>
				</div>
			</n-collapsible>
			<n-collapsible title="Glue utilities" :only-one-open="true">
				<div class="is-row is-pattern-basic-alternating is-spacing-gap-medium is-align-start">
					<n-form class="is-variant-vertical" content-class="is-column is-spacing-medium is-shadow-xsmall has-button-close" v-for="template in getTemplates('glue-utility')">
						<button class="is-button is-size-small is-variant-close" @click="deleteTemplate(template)"><icon name="times"/></button>
						<n-form-text v-model="template.title" label="Title" :timeout="600" @input="saveTemplate(template)"/>
						<n-form-text type="area" v-model="template.script" label="Glue script" :timeout="600" @input="function(script) { generateGlueInterface(template, script); saveTemplate(template) }"/>
						<div class="is-row is-spacing-gap-small" v-if="getInputVariables(template).length"><span class="is-content is-size-small">Inputs:</span><span class="is-badge" v-for="variable in getInputVariables(template)">{{variable}}</span></div>
						<div class="is-row is-spacing-gap-small" v-if="getOutputVariables(template).length"><span class="is-content is-size-small">Outputs:</span><span class="is-badge" v-for="variable in getOutputVariables(template)">{{variable}}</span></div>
					</n-form>
				</div>
				<div class="is-row">
					<button class="is-button is-variant-primary-outline is-size-small" @click="newTemplate('glue-utility')"><icon name="plus"/><span class="is-text">Glue utility</span></button>
				</div>
			</n-collapsible>
		</div>
		<div class=" is-column is-spacing-gap-medium" v-else>
			<div class="is-column is-spacing-gap-medium">
				<ul class="is-menu is-variant-toolbar">
					<li class="is-column" v-if="!autosave"><button class="is-button is-size-small is-variant-primary-outline" @click="save"><icon name="save"/><span class="is-text">Save</span></button></li>
					<li class="is-column"><button class="is-button is-size-small is-variant-secondary-outline" @click="showGlue = true"><icon name="search"/><span class="is-text">Raw</span></button></li>
					<li class="is-column" v-if="false"><button class="is-button is-size-small" @click="showConfiguration = true"><icon name="cog"/><span class="is-text">Configure</span></button></li>
					<li class="is-column" v-if="!manual && !running"><button class="is-button is-size-small is-variant-primary" @click="runScript(false)"><icon name="play"/><span class="is-text">Run Automated</span></button></li>
					<li class="is-column" v-if="!manual && !running"><button :disabled="matrix.length == 0 || variables.length == 0" class="is-button is-size-small is-variant-danger" @click="runMatrix"><icon name="play"/><span class="is-text">Run Matrix</span></button></li>
					<li class="is-column" v-if="!manual && !running"><button class="is-button is-size-small is-variant-secondary" @click="runManual"><icon name="hand-pointer"/><span class="is-text">Run Manual</span></button></li>
					<li class="is-column" v-if="manual"><button class="is-button is-size-small is-variant-danger" @click="stopManual"><icon name="stop"/><span class="is-text">Stop Manual</span></button></li>
					<li class="is-column" v-if="running"><button class="is-button is-size-small is-variant-danger"><icon name="cog"/><span class="is-text">Running...</span></button></li>
					<li class="is-column" v-if="lastSaved"><button class="is-button is-size-small" ref="lastSaved"><icon name="save"/><span class="is-text">Last saved: {{$services.formatter.date(lastSaved, 'HH:mm:ss')}}</span></button></li>
					<li class="is-column" v-if="lastSaveFailed"><button class="is-button is-size-small is-variant-danger-outline"><icon name="save"/><span class="is-text">Last save failed: {{$services.formatter.date(lastSaveFailed, 'HH:mm:ss')}}</span></button></li>
				</ul>
				<n-form-switch v-model="showAutomation" label="Show automation"/>
				<n-form-switch v-model="autosave" label="Autosave"/>
			</div>
			<n-form mode="component">
				<table class="is-table">
					<thead>
						<tr>
							<th class="is-border-none"></th>
							<th title="line number"></th>
							<th class="is-description-container"><div class="is-row is-spacing-gap-small"><span class="is-text">Description</span><span class="is-badge is-position-right" v-if="resultPaging.totalRowCount">{{resultPaging.totalRowCount}} runs</span></div></th>
							<th v-if="showAutomation"><div class="is-row is-spacing-gap-medium is-align-cross-center"><span class="is-text">Type</span></div></th>
							<th v-if="showAutomation"><div class="is-row is-spacing-gap-medium is-align-cross-center"><span class="is-text">Automation</span><n-form-switch class="is-position-right" label="Suggest all" v-model="showAllServices"/></div></th>
							<th v-for="result in results" :class="{'is-result-changed': !result.saved && manual != result}"><div class="is-column is-spacing-gap-xsmall">
								<div class="is-row is-align-center is-spacing-gap-small is-wrap-none"><span class="is-badge" v-if="result.testCaseIndex">{{result.testCaseIndex}}</span><span class="is-title">{{result.title ? result.title : result.runType}}</span><n-info v-if="result.description"><span v-html="result.description"/></n-info><div class="is-row is-position-right"><button class="is-button is-variant-secondary is-size-xsmall" v-if="hasRecording(result)" @click="showRecording(result)"><icon name="video"/></button><button class="is-button is-variant-ghost is-size-xsmall" @click="editResult(result)"><icon name="pencil-alt"/></button><button v-if='result.changed' class="is-button is-variant-ghost is-size-xsmall" @click="saveResult(result)"><icon name="save"/></button><button v-if="!result.saved" class="is-button is-variant-ghost is-size-xsmall" @click="deleteResult(result)"><icon name="times" class="is-color-danger-outline"/></button></div></div>
								<span class="is-content is-variant-subscript">{{$services.formatter.date(result.started, 'yyyy-MM-dd HH:mm:ss')}}</span>
							</div><n-absolute top="100%" left="0" v-if="editingResult == result" :autoclose="true" @close="function() { editingResult = null }">
								<n-form class="is-variant-vertical is-popup-form">
									<n-form-text v-model="result.title" label="Title"/>
									<n-form-text v-model="result.description" type="area" label="Description"/>
								</n-form>
							</n-absolute></th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(step, index) in steps" v-show="isVisibleStep(step)" :key="step.id" class="step" :class="{'is-disabled': !step.enabled}">
							<td class="is-border-none"><div class="is-column"><button class="is-button is-size-xsmall is-variant-ghost" @click="move(step, -1)"><icon name="chevron-up"/></button><button class="is-button is-size-xsmall is-variant-ghost" @click="move(step, 1)"><icon name="chevron-down"/></button></div></td>
							<td><div class="is-row is-spacing-small is-align-center"><button class="is-button is-variant-ghost is-size-xsmall" @click="addAfter(index)"><icon name="plus"/></button><span class="is-text is-line-number">{{formatLineNumber(index)}}</span><n-form-switch class="is-size-small" v-model="step.enabled" @input="debounceSave"/><button class="is-button is-variant-ghost is-size-xsmall" @click="remove(step)"><icon class="is-color-danger-outline" name="times"/></button></div></td>
							<td :class="{'is-disabled': !step.enabled}" class="is-description-container">
								<div class="is-column is-spacing-gap-small">
									<div class="is-row is-spacing-gap-small is-details-container">
										<button class="is-button is-variant-ghost is-size-xsmall" v-if="step.type == 'title' && step.expanded" @click="step.expanded = !step.expanded" :disabled="manual"><icon name='minus-square'/></button>
										<button class="is-button is-variant-ghost is-size-xsmall" v-if="step.type == 'title' && !step.expanded" @click="step.expanded = !step.expanded" :disabled="manual"><icon name='plus-square'/></button>
											<div :class="['is-depth' + step.depth, 'is-type-' + step.type]" class="is-content-wrapper is-description-wrapper"><div :key="step.id" ref="editors" 
												:step-id="step.id"
												@keydown.enter.ctrl="addAfter(index)" 
												@keydown.tab="tab(step, $event)" 
												@keydown.up.ctrl="move(step, -1)"
												@keydown.down.ctrl="move(step, 1)"
												@keydown.up.alt="shift(step, -1)"
												@keydown.down.alt="shift(step, 1)"
												class="is-inline-editor" 
												placeholder="Add title" 
												v-html-once="step.title ? step.title : ''" 
												@paste="paste(step, $event)" 
												:contenteditable="true" 
												@keyup="update(step, $event)" 
												@blur="update(step, $event)" 
												@input="update(step, $event)"></div>
											</div>
										<button class="is-button is-edit-details is-variant-ghost is-size-xsmall" @click="editStepDefinition(step)"><icon name="search"/></button>
										</div>
										<p v-if="step.summary" class="is-p is-variant-subscript" :class="'is-depth' + step.depth" v-html="$services.formatter.format(step.summary, {format: 'markdown'})"/>
									</div>
								<n-absolute top="100%" left="0" v-if="editingStepDefinition == step" :autoclose="true" @close="function() { editingStepDefinition = null; uploadStepAttachments(step); }">
								<n-form class="is-variant-vertical is-popup-form">
									<n-form-text v-model="step.summary" type="area" label="Summary" placeholder="Add some more information about this step in markdown syntax" @input="debounceSave"/>
									<n-form-text v-model="step.description" type="area" label="Notes" placeholder="Add some notes for people running this step manually using markdown syntax" @input="debounceSave"/>
									<n-input-file ref='form'
										:value='editingAttachments'
										browse-label="Browse or drag files"
										browse-icon="plus"
										:visualize-file-names="true"
										class="is-column"
										/>
								</n-form>
							</n-absolute></td>
							<td v-if="showAutomation && step.scriptType == 'glue'"><textarea 
								v-if="step.automate" 
								:step-id="step.id"
								class="automation-script" 
								v-model="step.script" 
								mode="javascript" 
								@input="resizeText(step, $event)" 
								ref="automationEditors"/></td>
							<td v-if="showAutomation">
								<n-form-combo v-model="step.scriptType" label="Type"
									class="is-variant-test-editor-automation-type is-label-horizontal"
									:items="[{name: 'service', label: 'Service'}, {name: 'glue-utility', label: 'Glue Utility'}, {name: 'glue-script', label: 'Glue Script'}, {name: 'selenium-utility', label: 'Selenium Utility'}, {name: 'selenium-script', label: 'Selenium Script'}]"
									:formatter="function(x) { return x.label }"
									:extracter="function(x) { return x.name }"
									@input="debounceSave"
									/>
							</td>
							<td v-if="showAutomation">
								<div class="is-column is-spacing-gap-small" v-if="step.scriptType">
									<div class="is-row is-spacing-gap-small is-align-cross-center">
										<n-form-combo 
											v-if="step.scriptType == 'service'"
											:value="step.script"
											label="Service"
											class="is-variant-test-editor-services is-label-horizontal"
											:timeout="600"
											:filter="suggestServices"
											:resolver="resolveService"
											:formatter="function(x) { return x.summary ? x.summary : x.id }"
											:pretty-formatter="serviceFormatter"
											:extracter="function(x) { return x.id }"
											@input="function(value, label, rawValue, selectedLabel) { updateService(step, rawValue, selectedLabel) }"
											/>
										<n-form-text class="is-fill-normal is-small-area" type="area" v-else-if="step.scriptType == 'selenium-script'" v-model="step.script" @input="function(value) { generateSeleniumInterface(step, value);debounceSave() }" />
										<n-form-text class="is-fill-normal is-small-area" type="area" v-else-if="step.scriptType == 'glue-script'" v-model="step.script" @input="function(value) { generateGlueInterface(step, value);debounceSave() }" />
										<n-form-combo 
											v-if="step.scriptType == 'selenium-utility'"
											v-model="step.script"
											label="Selenium Utility"
											class="is-variant-test-editor-services is-label-horizontal"
											:timeout="600"
											:pretty-formatter="serviceFormatter"
											:filter="suggestSeleniumUtilities"
											:formatter="function(x) { return x.title ? x.title : 'Untitled' }"
											:extracter="function(x) { return x.id }"
											@input="debounceSave"
											/>
										<n-form-combo 
											v-if="step.scriptType == 'glue-utility'"
											v-model="step.script"
											label="Utility"
											class="is-variant-test-editor-services is-label-horizontal"
											:timeout="600"
											:filter="suggestUtilities"
											:pretty-formatter="serviceFormatter"
											:formatter="function(x) { return x.title ? x.title : 'Untitled' }"
											:extracter="function(x) { return x.id }"
											@input="debounceSave"
											/>
										<button class="is-button is-size-small is-variant-ghost has-tooltip" @click="step.show = !step.show; closeOther(step)" v-if="step.script && (hasInputDefinition(step) || hasOutputDefinition(step))"><icon name="search"/><span class="is-tooltip">Show data mapping</span></button>
										<n-info v-if="step.script && getServiceInformation(step.script) && (getServiceInformation(step.script).summary || getServiceInformation(step.script).description)">
											<p class="summary" v-if="getServiceInformation(step.script).summary" v-html="getServiceInformation(step.script).summary"></p>
											<p class="description" v-if="getServiceInformation(step.script).description" v-html="getServiceInformation(step.script).description"></p>
										</n-info>
									</div>
									<div class="is-row is-spacing-gap-large is-align-start" v-if="step.show">
										<div class="is-column is-spacing-small is-fill-normal is-input-container">
											<h4 class="is-h4">Input</h4>
											<n-form class="is-variant-floating-labels" v-if="hasInputDefinition(step)">
												<n-page-mapper :to="getInputDefinition(step)"
													:allow-recursive-mapping="true"
													:drop-unused="true"
													:watch-for-changes="true"
													:allow-computed="false"
													:plain="true"
													:from="getPipeline(step)" 
													:key="'step-input-mapper-' + index"
													v-model="step.inputBindingsObject"
													@changed="debounceSave"
													/>
											</n-form>
										</div>
										<div class="is-column is-spacing-small is-fill-normal is-output-container">
											<h4 class="is-h4">Output</h4>
											<n-form-text v-model="step.outputBindings" 
												label="Variable name"
												class="is-label-horizontal"
												placeholder="Capture the output as a variable" 
												v-if="hasOutputDefinition(step)"
												:validator="validateVariableName"
												:validate-on-blur="true"
												@input="debounceSave"
												/>
											<span class="is-content is-variant-subscript">You can capture the value to use in later steps. Note that you must use camelCase naming convention for the variable name.</span>
										</div>
									</div>
								</div>
							</td>
							<td v-for="result in results" :class="{'is-result-changed': !result.saved && manual != result}">
								<div v-if="getResult(result, step)" class="is-row is-spacing-gap-small is-result is-align-center" :class="{'is-color-success-outline': getResult(result, step).severity == 'INFO', 'is-color-warning-outline': getResult(result, step).severity == 'WARNING', 'is-color-danger-outline': getResult(result, step).severity == 'ERROR' }">
									<icon class="is-spacing-xsmall is-size-xsmall" :name="getResult(result, step).severity == 'INFO' ? 'check' : (getResult(result, step).severity == 'WARNING' ? 'question' : 'times')" />
									<span class="is-badge" v-if="step.enabled && getResult(result, step).stopped">{{new Date(getResult(result, step).stopped).getTime() - new Date(getResult(result, step).started).getTime()}} ms</span>
									<n-info v-if="getResult(result, step).comment"><span v-html="getResult(result, step).comment"/></n-info>
									<n-info class="error" icon="question" v-if="getError(result, step)"><span v-html="getError(result, step)"/></n-info>
									<button v-for="attachment in getAttachmentsFor(result, step)" class="is-button is-variant-ghost is-size-xsmall" @click="showAttachment(attachment)"><icon :name="attachment.type && attachment.type.indexOf('image/') == 0 ? 'image' : 'file'"/></button>
								</div>
								<div v-else-if="result.runType != 'manual' || result != manual" class="is-row is-result is-color-warning-outline">
									<icon name="question" class="is-spacing-xsmall is-size-xsmall"/>
								</div>
								<div class="is-column is-spacing-gap-small" v-else-if="result.runType == 'manual' && isCurrentManualStep(result, step) && !result.stopped">
									<ul class="is-menu is-variant-toolbar">
										<li class="is-column"><button class="is-button is-size-small is-variant-success-outline" @click="setResult(result, step, 'INFO')"><icon name="check"/><span class="is-text">Yes</span></button></li>
										<li class="is-column"><button class="is-button is-size-small is-variant-danger-outline" @click="setResult(result, step, 'ERROR')"><icon name="times"/><span class="is-text">No</span></button></li>
										<li class="is-column"><button class="is-button is-size-small is-variant-warning-outline" @click="setResult(result, step, 'WARNING')"><icon name="chevron-down"/><span class="is-text">Skip</span></button></li>
										<li class="is-column"><button class="is-button is-size-small is-variant-neutral-outline" @click="editingStep = step"><icon name="pencil-alt"/><span class="is-text">Edit</span></button></li>
									</ul>
									<p v-if="step.description" v-html="$services.formatter.format(step.description, {format: 'markdown'})"/>
									<div class="is-row"><button class="is-button is-size-small is-variant-ghost" v-for="attachment in getAttachmentsForStep(step)" @click="showAttachment(attachment)"><icon :name="attachment.type && attachment.type.indexOf('image/') == 0 ? 'image' : 'file'"/></button></div>
								</div>
								<div v-else-if="result == manual && result.runType == 'manual' && !isCurrentManualStep(result,step) && !result.stopped && result.steps.length == 0">
									<button class="is-button is-size-small" @click="runUntil(step)"><icon name="play" class="is-size-xxsmall"/><span class="is-text">Automatically run until here</span></button>
								</div>
								<n-absolute v-if="editingStep == step && manual == result" top="100%" left="0" :autoclose="true" @close="function() { editingStep = null }">
									<n-form class="is-variant-vertical is-popup-form">
										<n-form-text type="area" label="Comment" v-model="editingStepContent.comment" v-focus />
										<n-form-text v-model="editingStepContent.issueId" label="Bug tracker issue id" />
										<n-input-file ref='form'
											:value='editingAttachments'
											browse-label="Browse or drag files"
											browse-icon="plus"
											:visualize-file-names="true"
											class="is-column"
											/>
									</n-form>
								</n-absolute>
							</td>
						</tr>
					</tbody>
				</table>
			</n-form>
			<n-sidebar v-if="showGlue" @close="function() { showGlue = false }">
				<div class="is-column is-spacing-medium">
					<code class="is-code is-variant-glue-script">
						{{buildGlue()}}
					</code>
				</div>
			</n-sidebar>
			<n-sidebar v-if="videoContent" @close="function() { videoContent = null }">
				<div class="is-column is-spacing-large">
					<h2 class="is-h2">Video</h2>
					<video :src="videoContent.url" width="800" height="600" controls autoplay/>
				</div>
			</n-sidebar>
			<n-sidebar v-if="imageContent" @close="function() { imageContent = null }">
				<div class="is-column is-spacing-large">
					<h2 class="is-h2">Image</h2>
					<img :src="imageContent.url" class="image-preview"/>
				</div>
			</n-sidebar>
			<n-sidebar v-if="seleniumContent" @close="function() { seleniumContent = null }">
				<div class="is-column is-spacing-large">
					<h2 class="is-h2">Selenium Recording</h2>
					<test-selenium-viewer :screenshots="seleniumContent.screenshots" :steps="seleniumContent.steps"/>
				</div>
			</n-sidebar>
		</div>
	</div>
</template>


<template id="test-selenium-viewer">
	<div class="test-selenium-viewer is-column is-spacing-gap-medium">
		<template v-if="frames.length == 0">
			<p>No frames available</p>
		</template>
		<template v-else>
			<div class="player is-row">
				<ul class="is-menu is-variant-toolbar">
					<li class="is-column" v-if="paused"><button class="is-button is-size-small is-variant-primary-outline" @click="startPlay"><icon name="play"/><span class="is-text">Play</span></button></li>
					<li class="is-column" v-else><button class="is-button is-size-small is-variant-primary-outline" @click="pause"><icon name="pause"/><span class="is-text">Pause</span></button></li>
					<li class="is-column" v-if="!paused"><button class="is-button is-size-small is-variant-danger-outline" @click="stop"><icon name="stop"/><span class="is-text">Stop</span></button></li>
					<li class="is-column" v-if="!paused"><button class="is-button is-size-small"><span class="is-text">{{timer}}ms</span></button></li>
				</ul>
			</div>
			<div class="is-row is-spacing-gap-small">
				<div class="steps is-column">
					<div v-for="step in steps" class="is-row">
						<button :class="[{'is-active': currentStep == step}, getCalculatedStateClass(step)]" class="is-button is-size-small is-fill-normal is-border-radius-none" @click="selectStep(step)"><span class="is-text">{{step.command}}</span><span v-if="step.value"> {{step.value}}</span><span v-if="step.target"> on {{step.target}}</span></button>
					</div>
				</div>
				<div class="player">
					<img v-if="currentFrame >= 0" :src="frames[currentFrame].url" class="image-player" @load="imageLoaded"/>
					<n-form-text type="range" :minimum="0" :maximum="frames.length - 1" v-model="currentFrame"/>
				</div>
			</div>
		</template>
	</div>
</template>


