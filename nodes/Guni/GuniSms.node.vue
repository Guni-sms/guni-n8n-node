<template>
  <div class="n8n-row">
    <n8n-form-item label="Sender ID" :required="true">
      <n8n-select
        v-model="senderId"
        :options="node.parameters.senderId.options"
        @change="onSenderChange"
      />
    </n8n-form-item>

    <n8n-form-item label="Message Type">
      <n8n-select
        v-model="messageType"
        :options="node.parameters.messageType.options"
      />
    </n8n-form-item>

    <n8n-form-item label="Template">
      <n8n-select
        v-model="templateId"
        :options="node.parameters.templateId.options"
        @change="onTemplateChange"
      />
    </n8n-form-item>

    <n8n-form-item label="Message">
      <n8n-textarea
        v-model="message"
        :rows="5"
        placeholder="Message from template or previous node will appear here"
        @input="onMessageChange"
      />
      <div>
        {{ messageLength }} characters, {{ smsParts }} SMS(s)
      </div>
    </n8n-form-item>

    <n8n-form-item label="Allow Unicode">
      <n8n-checkbox v-model="allowUnicode" />
    </n8n-form-item>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const message = ref('');
const templateId = ref('');
const senderId = ref('');
const messageType = ref('notification');
const allowUnicode = ref(false);
const smsParts = ref(1);
const messageLength = ref(0);

const ENGLISH_GATEWAY_SMS_CONFIG = [
  { min: 1, max: 160, sms: 1 },
  { min: 161, max: 306, sms: 2 },
  { min: 307, max: 459, sms: 3 },
  { min: 460, max: 612, sms: 4 },
  { min: 613, max: 765, sms: 5 },
  { min: 766, max: 918, sms: 6 },
  { min: 919, max: 1071, sms: 7 },
  { min: 1072, max: 1224, sms: 8 },
];
const UNICODE_GATEWAY_SMS_CONFIG = [
  { min: 1, max: 70, sms: 1 },
  { min: 71, max: 134, sms: 2 },
  { min: 135, max: 201, sms: 3 },
  { min: 202, max: 268, sms: 4 },
  { min: 269, max: 335, sms: 5 },
  { min: 336, max: 402, sms: 6 },
  { min: 403, max: 469, sms: 7 },
  { min: 470, max: 536, sms: 8 },
];

function updateSmsCount(msg: string) {
  const isUnicode = /[^\x00-\x7F]/.test(msg);
  const config = isUnicode ? UNICODE_GATEWAY_SMS_CONFIG : ENGLISH_GATEWAY_SMS_CONFIG;
  const matched = config.find((r) => msg.length >= r.min && msg.length <= r.max);
  smsParts.value = matched ? matched.sms : 1;
  messageLength.value = msg.length;
}

function onMessageChange() {
  updateSmsCount(message.value);
}

function onTemplateChange() {
  const option = node.parameters.templateId.options.find((o: any) => o.value === templateId.value);
  if (option && !message.value) {
    message.value = option.content || '';
    onMessageChange();
  }
}

function onSenderChange() {}
</script>
