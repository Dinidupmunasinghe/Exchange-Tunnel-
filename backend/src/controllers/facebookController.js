const {
  fetchFacebookProfileByAccessToken,
  fetchSelectedPagePostsByAccessToken,
  fetchFacebookPostOpenGraphPreview,
  exchangeFacebookCodeForUserAccessToken,
  fetchManagedPagesByAccessToken,
  fetchManagedPages
} = require("../services/facebookService");
const { decrypt } = require("../utils/crypto");

function getSelectedPageSession(user) {
  if (!user?.facebookPageId || !user?.facebookPageAccessTokenEncrypted) {
    const error = new Error("Select a Facebook Page in Settings first");
    error.status = 400;
    throw error;
  }
  return {
    pageId: String(user.facebookPageId),
    pageName: user.facebookPageName ? String(user.facebookPageName) : null,
    pageToken: decrypt(user.facebookPageAccessTokenEncrypted)
  };
}

async function connectFacebook(req, res) {
  let accessToken = req.body.accessToken;
  const { code, redirectUri } = req.body;

  if (!accessToken && code && redirectUri) {
    accessToken = await exchangeFacebookCodeForUserAccessToken(code, redirectUri, "pages");
  }
  if (!accessToken) {
    return res.status(400).json({ message: "accessToken or code+redirectUri is required" });
  }

  const profile = await fetchFacebookProfileByAccessToken(accessToken, "pages").catch(() => null);
  req.user.setFacebookToken(accessToken);

  if (profile?.id) {
    req.user.facebookUserId = profile.id;
    if (!req.user.name && profile.name) req.user.name = profile.name;
  }

  await req.user.save();
  const pages = await fetchManagedPagesByAccessToken(accessToken).catch(() => []);
  return res.json({
    message: "Facebook account connected",
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      category: page.category,
      tasks: page.tasks,
      pictureUrl: page.pictureUrl
    }))
  });
}

async function getMyFacebookPosts(req, res) {
  try {
    const { pageId, pageName, pageToken } = getSelectedPageSession(req.user);
    const posts = await fetchSelectedPagePostsByAccessToken(pageId, pageToken);
    return res.json({
      page: {
        id: pageId,
        name: pageName
      },
      posts
    });
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message || "Could not load Page posts" });
  }
}

async function getPostPreview(req, res) {
  const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!url) {
    return res.status(400).json({ message: "url query parameter is required" });
  }
  const preview = await fetchFacebookPostOpenGraphPreview(url);
  return res.json(preview);
}

async function getManagedPages(req, res) {
  if (!req.user.facebookAccessTokenEncrypted) {
    return res.status(400).json({ message: "Facebook account not connected" });
  }
  const pages = await fetchManagedPages(req.user.facebookAccessTokenEncrypted);
  return res.json({
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      category: page.category,
      tasks: page.tasks,
      pictureUrl: page.pictureUrl,
      selected: req.user.facebookPageId === page.id
    })),
    selectedPageId: req.user.facebookPageId || null
  });
}

async function selectManagedPage(req, res) {
  const { pageId } = req.body;
  if (!req.user.facebookAccessTokenEncrypted) {
    return res.status(400).json({ message: "Facebook account not connected" });
  }
  const pages = await fetchManagedPages(req.user.facebookAccessTokenEncrypted);
  const page = pages.find((item) => item.id === String(pageId));
  if (!page || !page.accessToken) {
    return res.status(404).json({ message: "Managed Page not found" });
  }

  req.user.setFacebookPageToken(page);
  await req.user.save();
  return res.json({
    message: "Facebook Page selected",
    page: {
      id: page.id,
      name: page.name,
      category: page.category,
      tasks: page.tasks,
      pictureUrl: page.pictureUrl
    }
  });
}

async function clearSelectedPage(req, res) {
  req.user.clearFacebookPage();
  await req.user.save();
  return res.json({ message: "Selected Page removed" });
}

module.exports = {
  connectFacebook,
  getMyFacebookPosts,
  getPostPreview,
  getManagedPages,
  selectManagedPage,
  clearSelectedPage
};
