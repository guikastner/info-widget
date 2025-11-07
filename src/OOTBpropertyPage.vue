<script setup>
/**
 * Launches the out-of-the-box properties panel for the given physical ID.
 * Uses PlatformAPI to open the Properties widget (ENOLCMT_AP).
 */
const launchOOTBProperties = (physicalid) => {
  requirejs(["DS/PlatformAPI/PlatformAPI"], (PlatformAPI) => {
    const options = {
      mode: "panel",
      height: 800,
      width: 800,
    };

    const widgetData = {
      SelectedItem: [
        {
          source: "3DSpace",
          objectId: physicalid,
        },
      ],
      editProperties_editMode: "false",
      readOnly: "false",
      isTransient: "true",
    };

    PlatformAPI.publish("ShowWidget", {
      appId: "ENOLCMT_AP",
      title: "",
      data: widgetData,
      options,
    });
  });
};

// Make function globally available to be used from other components like FinalWithVuetify
window.launchOOTBProperties = launchOOTBProperties;
</script>
