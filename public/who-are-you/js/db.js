(function (global) {
  "use strict";

  var EXPORT_VERSION = 1;

  var STORES = [
    "profile",
    "employments",
    "projects",
    "educations",
    "certifications",
    "documents",
  ];


  function defaultProfile() {
    return {
      id: "profile",
      name: "",
      nameEn: "",
      email: "",
      phone: "",
      headline: "",
      summary: "",
      targetRole: "",
      skills: [],
      links: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function slug(title, existing) {
    var base = String(title)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\uac00-\ud7a3-]/g, "")
      .slice(0, 32);
    if (!base) base = "item";
    var id = base;
    var n = 2;
    while (existing[id]) {
      id = base + "-" + n;
      n += 1;
    }
    return id;
  }

  function getAllStore(storeName) {
    if (storeName === "profile") return Promise.resolve(global.PortalCloud.read("who-are-you/profile", "profile") || defaultProfile());
    return Promise.resolve(global.PortalCloud.list("who-are-you/" + storeName));
  }

  function putStoreItem(storeName, item) {
    item.updatedAt = new Date().toISOString();
    return global.PortalCloud.write("who-are-you/" + storeName, item.id, item);
  }

  function deleteStoreItem(storeName, id) {
    return global.PortalCloud.write("who-are-you/" + storeName, id, null);
  }

  function loadBundle() {
    return Promise.all(STORES.map(getAllStore)).then(function (parts) {
      var bundle = {};
      STORES.forEach(function (name, i) { bundle[name] = parts[i]; });
      return bundle;
    });
  }

  function saveProfile(profile) {
    profile.id = "profile";
    return putStoreItem("profile", profile);
  }

  function clearBundle() {
    return Promise.all(STORES.map(function (name) { return global.PortalCloud.clear("who-are-you/" + name); }));
  }

  function importBundle(data, replace) {
    var incoming = {
      profile: data.profile || defaultProfile(),
      employments: data.employments || [],
      projects: data.projects || [],
      educations: data.educations || [],
      certifications: data.certifications || [],
      documents: data.documents || [],
    };
    incoming.profile.id = "profile";
    var run = replace ? clearBundle() : Promise.resolve();
    return run.then(function () {
      return saveProfile(incoming.profile).then(function () {
        var lists = ["employments", "projects", "educations", "certifications", "documents"];
        return lists.reduce(function (chain, storeName) {
          return chain.then(function () {
            return Promise.all(
              (incoming[storeName] || []).map(function (item) {
                if (!item.id) item.id = slug(item.title || item.projectName || item.companyName || "item", {});
                return putStoreItem(storeName, item);
              })
            );
          });
        }, Promise.resolve());
      });
    });
  }

  function exportPayload(bundle) {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      bundle: bundle,
    };
  }

  function seedIfEmpty() { return loadBundle(); }

  global.WhoAreYouDb = {
    DOCUMENT_CATEGORIES: {
      motivation: "지원동기",
      growth: "성장과정",
      strength: "성격·장단점",
      vision: "입사 후 포부",
      full: "통합 자기소개서",
      custom: "기타",
    },
    EMPLOYMENT_TYPES: {
      regular: "정규직",
      contract: "계약직",
      freelance: "프리랜서",
    },
    loadBundle: loadBundle,
    saveProfile: saveProfile,
    getProfile: function () {
      return getAllStore("profile");
    },
    listEmployments: function () {
      return getAllStore("employments");
    },
    listProjects: function () {
      return getAllStore("projects");
    },
    listEducations: function () {
      return getAllStore("educations");
    },
    listCertifications: function () {
      return getAllStore("certifications");
    },
    listDocuments: function () {
      return getAllStore("documents");
    },
    putEmployment: function (item) {
      return putStoreItem("employments", item);
    },
    putProject: function (item) {
      return putStoreItem("projects", item);
    },
    putEducation: function (item) {
      return putStoreItem("educations", item);
    },
    putCertification: function (item) {
      return putStoreItem("certifications", item);
    },
    putDocument: function (item) {
      return putStoreItem("documents", item);
    },
    deleteEmployment: function (id) {
      return deleteStoreItem("employments", id);
    },
    deleteProject: function (id) {
      return deleteStoreItem("projects", id);
    },
    deleteEducation: function (id) {
      return deleteStoreItem("educations", id);
    },
    deleteCertification: function (id) {
      return deleteStoreItem("certifications", id);
    },
    deleteDocument: function (id) {
      return deleteStoreItem("documents", id);
    },
    getItem: function (storeName, id) {
      return getAllStore(storeName).then(function (list) {
        if (storeName === "profile") return list;
        return (list || []).find(function (x) {
          return x.id === id;
        });
      });
    },
    importBundle: importBundle,
    exportPayload: exportPayload,
    seedIfEmpty: seedIfEmpty,
    slug: slug,
    getStorageMode: function () {
      return Promise.resolve("supabase");
    },
  };
})(window);
