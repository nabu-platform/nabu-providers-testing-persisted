<template id="test-editor">
	<div class="is-test-editor is-column is-spacing-gap-medium">
		<ul class="is-menu is-variant-toolbar">
			<li class="is-column"><button class="is-button is-size-small is-variant-primary-outline" @click="save"><icon name="save"/><span class="is-text">Save</span></button></li>
			<li class="is-column"><button class="is-button is-size-small is-variant-secondary-outline" @click="showGlue = true"><icon name="search"/><span class="is-text">Raw</span></button></li>
			<li class="is-column"><button class="is-button is-size-small" @click="showConfiguration = true"><icon name="cog"/><span class="is-text">Configure</span></button></li>
			<li class="is-column"><button v-if="!manual" class="is-button is-size-small is-variant-primary" @click="runScript(false)"><icon name="play"/><span class="is-text">Run Automated</span></button></li>
			<li class="is-column"><button v-if="!manual" :disabled="matrix.length == 0 || variables.length == 0" class="is-button is-size-small is-variant-danger" @click="runMatrix"><icon name="play"/><span class="is-text">Run Matrix</span></button></li>
			<li class="is-column"><button v-if="!manual" class="is-button is-size-small is-variant-secondary" @click="runManual"><icon name="hand-pointer"/><span class="is-text">Run Manual</span></button></li>
			<li class="is-column"><button v-if="manual" class="is-button is-size-small is-variant-danger" @click="stopManual"><icon name="stop"/><span class="is-text">Stop Manual</span></button></li>
		</ul>
		<n-form mode="component">
			<table class="is-table">
				<thead>
					<tr>
						<th class="is-border-none"></th>
						<th title="line number"></th>
						<th class="is-description-container">Description</th>
						<th v-if="showAutomation"><div class="is-row is-spacing-gap-medium is-align-cross-center"><span class="is-text">Automation</span><n-form-switch v-model="showAllServices"/></div></th>
						<th v-for="result in results"><div class="is-column is-spacing-gap-xsmall"><span class="is-title">{{result.runType}}</span><span class="is-content is-variant-subscript">{{$services.formatter.date(result.started, 'yyyy-MM-dd HH:mm:ss')}}</span></div></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(step, index) in steps" :key="step.id" class="step" :class="{'is-disabled': !step.enabled}">
						<td class="is-border-none"><div class="is-column"><button class="is-button is-size-xsmall is-variant-ghost" @click="move(step, -1)"><icon name="chevron-up"/></button><button class="is-button is-size-xsmall is-variant-ghost" @click="move(step, 1)"><icon name="chevron-down"/></button></div></td>
						<td><div class="is-row is-spacing-small is-align-center"><button class="is-button is-variant-ghost is-size-xsmall" @click="addAfter(index)"><icon name="plus"/></button><span class="is-text is-line-number">{{formatLineNumber(index)}}</span><n-form-switch class="is-size-small" v-model="step.enabled"/><button class="is-button is-variant-ghost is-size-xsmall" @click="remove(step)"><icon class="is-color-danger-outline" name="times"/></button></div></td>
						<td :class="{'is-disabled': !step.enabled}" class="is-description-container"><div :class="['is-depth' + step.depth, 'is-type-' + step.type]" class="is-content-wrapper is-description-wrapper"><div :key="step.id" ref="editors" 
							:step-id="step.id"
							@keydown.enter.ctrl="addAfter(index)" 
							@keydown.tab="tab(step, $event)" 
							@keydown.up.ctrl="move(step, -1)"
							@keydown.down.ctrl="move(step, 1)"
							@keydown.up.alt="shift(step, -1)"
							@keydown.down.alt="shift(step, 1)"
							class="is-inline-editor" 
							placeholder="Add description" 
							v-html-once="step.description ? step.description : ''" 
							@paste="paste(step, $event)" 
							:contenteditable="true" 
							@keyup="update(step, $event)" 
							@blur="update(step, $event)" 
							@input="update(step, $event)"></div></div></td>
						<td v-if="showAutomation && step.scriptType == 'glue'"><textarea 
							v-if="step.automate" 
							:step-id="step.id"
							class="automation-script" 
							v-model="step.script" 
							mode="javascript" 
							@input="resizeText(step, $event)" 
							ref="automationEditors"/></td>
						<td v-if="showAutomation && step.scriptType == 'service'">
							<div class="is-column is-spacing-gap-small">
								<div class="is-row is-spacing-gap-small is-align-cross-center">
									<n-form-combo :value="step.script"
										label="Service to run"
										class="is-variant-test-editor-services is-label-horizontal"
										:timeout="600"
										:filter="suggestServices"
										:resolver="resolveService"
										:formatter="function(x) { $window.console.log('formatting', x); return x.summary ? x.summary : x.id }"
										:pretty-formatter="serviceFormatter"
										:extracter="function(x) { return x.id }"
										@input="function(value, label, rawValue) { updateService(step, rawValue) }"
										/>
									<button class="is-button is-size-small is-variant-ghost has-tooltip" @click="step.show = !step.show; closeOther(step)" v-if="step.script && (step.inputDefinition || step.outputDefinition)"><icon name="search"/><span class="is-tooltip">Show data mapping</span></button>
									<n-info v-if="step.script && getServiceInformation(step.script) && (getServiceInformation(step.script).summary || getServiceInformation(step.script).description)">
										<p class="summary" v-if="getServiceInformation(step.script).summary" v-html="getServiceInformation(step.script).summary"></p>
										<p class="description" v-if="getServiceInformation(step.script).description" v-html="getServiceInformation(step.script).description"></p>
									</n-info>
								</div>
								<div class="is-row is-spacing-gap-large is-align-start" v-if="step.show">
									<div class="is-column is-spacing-small is-fill-normal is-input-container">
										<h4 class="is-h4">Input</h4>
										<n-form class="is-variant-floating-labels" v-if="step.inputDefinition">
											<n-page-mapper :to="getInputDefinition(step)"
												:watch-for-changes="true"
												:allow-computed="false"
												:plain="true"
												:from="getPipeline(step)" 
												:key="'step-input-mapper-' + index"
												v-model="step.inputBindingsObject"
												/>
										</n-form>
									</div>
									<div class="is-column is-spacing-small is-fill-normal is-output-container">
										<h4 class="is-h4">Output</h4>
										<n-form-text v-model="step.outputBindings" 
											label="Variable name"
											class="is-label-horizontal"
											placeholder="Capture the output as a variable" 
											v-if="step.outputDefinition"
											:validator="validateVariableName"
											:validate-on-blur="true"
											after="You can capture the value to use in later steps. Note that you must use camelCase naming convention for the variable name."/>
									</div>
								</div>
							</div>
						</td>
						<td v-for="result in results">
							<div v-if="getResult(result, step)" class="is-row is-spacing-gap-small is-result" :class="{'is-color-success-outline': getResult(result, step).severity == 'INFO', 'is-color-warning-outline': getResult(result, step).severity == 'WARNING', 'is-color-danger-outline': getResult(result, step).severity == 'ERROR' }">
								<icon class="is-spacing-xsmall is-size-xsmall" :name="getResult(result, step).severity == 'INFO' ? 'check' : (getResult(result, step).severity == 'WARNING' ? 'question' : 'times')" />
								<span class="is-badge" v-if="getResult(result, step).stopped">{{new Date(getResult(result, step).stopped).getTime() - new Date(getResult(result, step).started).getTime()}} ms</span>
							</div>
							<div v-else-if="result.runType != 'manual'" class="is-row is-result is-color-warning-outline">
								<icon name="question" class="is-spacing-xsmall is-size-xsmall"/>
							</div>
							<ul class="is-menu is-variant-toolbar" v-else-if="result.runType == 'manual' && isCurrentManualStep(result, step) && !result.stopped">
								<li class="is-column"><button class="is-button is-size-small is-variant-success-outline" @click="setResult(result, step, 'INFO')"><icon name="check"/><span class="is-text">Succeeded</span></button></li>
								<li class="is-column"><button class="is-button is-size-small is-variant-danger-outline" @click="setResult(result, step, 'ERROR')"><icon name="times"/><span class="is-text">Failed</span></button></li>
								<li class="is-column"><button class="is-button is-size-small is-variant-warning-outline" @click="setResult(result, step, 'WARNING')"><icon name="chevron-down"/><span class="is-text">Ignored</span></button></li>
							</ul>
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
		<n-sidebar v-if="showConfiguration" @close="function() { showConfiguration = false }">
			<div class="is-row">
				<button @click="configurationTab = 'variables'" class="is-button is-variant-tab" :class="{'is-active': configurationTab == 'variables'}">Variables</button>
				<button :disabled="!variables.length" @click="configurationTab = 'matrix'" class="is-button is-variant-tab" :class="{'is-active': configurationTab == 'matrix'}">Matrix</button>
				<button @click="configurationTab = 'settings'" class="is-button is-variant-tab" :class="{'is-active': configurationTab == 'settings'}">Settings</button>
			</div>
			<n-form class="is-variant-vertical" content-class="is-column is-spacing-small" v-if="configurationTab == 'variables'">
				<div class="is-column is-spacing-medium is-color-body has-button-close" v-for="(variable, index) in variables">
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
				<n-form-text v-model="testCase.description" type="area" label="Description"/>
			</n-form>
			<n-form class="is-variant-vertical" content-class="is-column is-spacing-small" v-if="configurationTab == 'matrix'">
				<table class="is-table">
					<thead>
						<tr>
							<th v-for="variable in variables">{{variable.name}}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(record, index) in matrix">
							<td v-for="variable in variables"><n-form-text v-model="record[variable.name]" :placeholder="variable.default"/></td>
						</tr>
					</tbody>
				</table>
				<div class="is-row is-align-end">
					<button class="is-button is-variant-primary-outline is-size-xsmall" @click="matrix.push({})"><icon name="plus"/><span class="is-text">Record</span></button>
				</div>
			</n-form>
		</n-sidebar>
	</div>
</template>