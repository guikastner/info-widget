<template>
  <v-app>
    <v-data-table :headers="headers" :items="filteredIssues">
      <!-- HEADER SLOT -->
      <template #headers>
        <tr>
          <th v-for="header in headers" :key="header.value">
            {{ header.text }}
          </th>
        </tr>
      </template>

      <!-- ITEM SLOT -->
      <template #item="props">
        <tr
          :class="{
            'row-highlight': props.item.requirement.find((r) => r.id === highlightReqId),
          }"
          @drop="handleDrop(props.item.id, $event)"
          @dragenter.prevent
          @dragover.prevent
        >
          <td>{{ props.item.id }}</td>
          <td>{{ props.item.title }}</td>
          <td>{{ props.item.description }}</td>
          <td>
            <v-chip :color="getColor(props.item.status)">
              {{ props.item.status }}
            </v-chip>
          </td>
          <td>
            <span v-for="(req, index) in props.item.requirement" :key="req.id">
              <span @click="openReqInfo(req.id)" style="color: blue; cursor: pointer">
                {{ req.name }}
              </span>
              <span v-if="index < props.item.requirement.length - 1">, </span>
            </span>
          </td>
        </tr>
      </template>
    </v-data-table>
  </v-app>
</template>

<style>
.row-highlight {
  background-color: #85b3f9;
}
</style>

<script setup>
import { ref, computed, onMounted } from "vue";
import issues from "@/assets/config/issues.json";

//varibles
const headers = ref([
  { text: "ID", value: "id" },
  { text: "Title", value: "title" },
  { text: "Description", value: "description" },
  { text: "Status", value: "status" },
  { text: "Requirement", value: "requirement" },
]);

const issuesList = ref([]);
const searchQuery = ref("");
const projectId = ref("");
const highlightReqId = ref("");
const spaceUrl = ref("");
const securityContext = ref("");

// Computed property for filtering issues based on searchQuery
const filteredIssues = computed(() =>
  issuesList.value.filter((issue) => issue.title.includes(searchQuery.value))
);

// Main drop handler
const handleDrop = async (issueId, event) => {
  const droppedData = JSON.parse(event.dataTransfer.getData("text"));
  const reqId = droppedData.data.items[0].objectId;

  const issue = issuesList.value.find((i) => i.id === issueId);
  if (!issue) return;

  const alreadyLinked = issue.requirement.some((requirement) => requirement.id === reqId);
  if (alreadyLinked) return;

  await sendRequirement(issueId, reqId);
  await fetchDataFrom3DSpace(issueId, reqId);
};

// Send new Requiremet to backend
const sendRequirement = async (issueId, reqId) => {
  console.log("Sending to backend:", { reqId, issueId });

  await fetch("https://localhost:8081/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reqId, issueId }),
  });
};

// Fetch and update UI from 3DSpace
const fetchDataFrom3DSpace = async (issueId, reqId) => {
  const reqInfo = await getRequirementInfo(reqId);
  console.log("Fetched requirement info:", reqInfo);

  const issue = issuesList.value.find((i) => i.id === issueId);
  if (issue) {
    issue.requirement.push({
      id: reqId,
      name: reqInfo.member[0].title,
    });
  }
};

const subscribeToEvents = async () => {
  const PlatformAPI = requirejs("DS/PlatformAPI/PlatformAPI");
  PlatformAPI.subscribe("DS/PADUtils/PADCommandProxy/select", (data1) => {
    const id = data1.data.paths[0].pop();
    if (id) {
      highlightReqId.value = id;
      setTimeout(() => {
        highlightReqId.value = "";
      }, 1000);
    }
  });
};

// Get 3DSpace URL
const getURL = () => {
  return new Promise((resolve, reject) => {
    requirejs(["DS/i3DXCompassServices/i3DXCompassServices"], (i3DXCompassServices) => {
      i3DXCompassServices.getServiceUrl({
        serviceName: "3DSpace",
        platformId: widget.getValue("x3dPlatformId"),
        onComplete: (URLResult) => {
          console.log("3DSpace URL:", URLResult);
          spaceUrl.value = URLResult;
          resolve();
        },
        onFailure: (error) => {
          reject(error);
        },
      });
    });
  });
};

// Get security context
const getCollaborativeSpace = async () => {
  const securityContextURL =
    "/resources/modeler/pno/person?current=true&select=preferredcredentials&select=collabspaces";

  requirejs(["DS/WAFData/WAFData"], (WAFData) => {
    const fullURL = spaceUrl.value + securityContextURL;

    WAFData.authenticatedRequest(fullURL, {
      type: "json",
      onComplete: (secContext) => {
        console.log(secContext);
        const role = secContext.preferredcredentials.role.name;
        const collabspace = secContext.preferredcredentials.collabspace.name;
        const org = secContext.preferredcredentials.organization.name;
        securityContext.value = `${role}.${org}.${collabspace}`;
        console.log("Security Context:", securityContext.value);
      },
      onFailure: (error) => {
        console.error("Error while fetching security context:", error);
      },
    });
  });
};

// Fetch requirement info from 3DSpace
const getRequirementInfo = async (reqId) => {
  return new Promise((resolve, reject) => {
    requirejs(["DS/WAFData/WAFData"], (WAFData) => {
      const reqInfoURL = `${spaceUrl.value}/resources/v1/modeler/dsreq/dsreq:Requirement/`;

      WAFData.authenticatedRequest(`${reqInfoURL}${reqId}`, {
        headers: {
          SecurityContext: securityContext.value,
        },
        method: "GET",
        type: "json",
        onComplete: (data) => {
          resolve(data);
        },
        onFailure: (error) => {
          reject(error);
        },
      });
    });
  });
};

// Function to setup widget preferences
const setupPreferences = () => {
  widget.addPreference({
    name: "Widget Title",
    type: "text",
    defaultValue: "",
  });

  widget.addPreference({
    name: "Project ID",
    type: "text",
    defaultValue: 240,
  });

  widget.addEvent("onRefresh", () => {
    projectId.value = widget.getValue("Project ID");
    issuesList.value = issues[projectId.value];
    widget.setTitle(widget.getValue("Widget Title"));
  });

  projectId.value = widget.getValue("Project ID");
  issuesList.value = issues[projectId.value];
  widget.setTitle(widget.getValue("Widget Title"));
};

// Color helper
const getColor = (status) => {
  switch (status) {
    case "New":
      return "purple lighten-3";
    case "In_Work":
      return "blue lighten-3";
    case "Under Review":
      return "amber lighten-3";
    case "Done":
      return "green lighten-3";
    default:
      return "";
  }
};

const openReqInfo = (reqId) => {
  window.launchOOTBProperties?.(reqId);
};

// Initialize on mount
onMounted(async () => {
  setupPreferences();
  subscribeToEvents();
  await getURL();
  getCollaborativeSpace();
});
</script>
