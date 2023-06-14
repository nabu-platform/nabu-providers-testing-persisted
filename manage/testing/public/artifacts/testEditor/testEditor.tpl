<template id="test-editor">
	<div class="is-test-editor">
		<n-form class="is-variant-floating-labels">
			<table class="is-table">
				<thead>
					<tr>
						<th title="line number"></th>
						<th>Description</th>
						<th v-if="showAutomation">Automate</th>
						<th v-if="showAutomation">Run</th>
						<th v-if="showAutomation">Input</th>
						<th v-if="showAutomation">Output</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(step, index) in steps">
						<td><div class="is-row is-spacing-small"><icon v-if="step.type == 'step'" :name="step.automate ? 'server' : 'hand-pointer'"/><span class="is-text">{{formatLineNumber(index)}}</span></div></td>
						<td><div :class="['is-depth' + step.depth, 'is-type-' + step.type]" class="is-content-wrapper is-description-wrapper"><div :key="step.id" ref="editors" 
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
						<td v-if="showAutomation"><n-form-switch v-if="step.automate || step.type == 'step'" v-model="step.automate" label="Automate"/></td>
						<td v-if="showAutomation && step.scriptType == 'glue'"><textarea 
							v-if="step.automate" 
							:step-id="step.id"
							class="automation-script" 
							v-model="step.script" 
							mode="javascript" 
							@input="resizeText(step, $event)" 
							ref="automationEditors"/></td>
						<td v-if="showAutomation && step.scriptType == 'service'">
							<n-form-combo :value="step.script"
								:timeout="600"
								:filter="suggestServices"
								:formatter="function(x) { return x.summary ? x.summary : x.id }"
								:extracter="function(x) { return x.id }"
								@input="function(value, label, rawValue) { updateService(step, rawValue) }"
								/>
						</td>
						<td v-if="showAutomation && step.scriptType == 'service'">
							<n-page-mapper :to="getInputDefinition(step)"
								:plain="true"
								:from="getPipeline(step)" 
								:value="getInputBindings(step)"
								@input="function(value) { setInputBindings(step, value) }"/>
						</td>
						<td v-if="showAutomation && step.scriptType == 'service'">
							<n-form-text v-model="step.outputBinding" label="Capture as"/>
						</td>
					</tr>
				</tbody>
			</table>
		</n-form>
	</div>
</template>