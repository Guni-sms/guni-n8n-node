<template>
  <div>
    <!-- Template Dropdown -->
    <n8n-form-input
      label="Template"
      type="select"
      v-model="templateId"
      :options="templates"
      @change="onTemplateChange"
    />

    <!-- Message Textarea -->
    <n8n-form-textarea
      label="Message"
      v-model="message"
      rows="5"
      placeholder="Message from template or previous node will appear here"
    />

    <!-- Character Count & SMS Parts -->
    <div style="margin-top:5px; font-size:12px; color:#555;">
      Character count: {{ message.length }} | SMS parts: {{ smsParts }}
    </div>
  </div>
</template>

<script>
export default {
  props: {
    nodeData: Object, // Node property data
  },

  data() {
    return {
      message: this.nodeData?.message || '',
      templateId: this.nodeData?.templateId || '',
      templates: [
        { name: 'Custom Message', value: '' },
        // Backend will fill actual templates via props or API
      ],
    };
  },

  computed: {
    smsParts() {
      const len = this.message.length;
      const isUnicode = /[^\x00-\x7F]/.test(this.message);
      if (isUnicode) {
        if (len <= 70) return 1;
        if (len <= 134) return 2;
        if (len <= 201) return 3;
        if (len <= 268) return 4;
        if (len <= 335) return 5;
        return Math.ceil(len / 67); // For very long messages
      } else {
        if (len <= 160) return 1;
        if (len <= 306) return 2;
        if (len <= 459) return 3;
        if (len <= 612) return 4;
        if (len <= 765) return 5;
        return Math.ceil(len / 153); // For very long messages
      }
    },
  },

  methods: {
    onTemplateChange() {
      const selected = this.templates.find(t => t.value === this.templateId);
      if (selected && selected.content) {
        this.message = selected.content; // Auto-fill message
      } else {
        this.message = ''; // Custom Message selected
      }
    },
  },

  watch: {
    message(newValue) {
      if (this.nodeData) this.nodeData.message = newValue;
    },
    templateId(newValue) {
      if (this.nodeData) this.nodeData.templateId = newValue;
    },
  },
};
</script>
