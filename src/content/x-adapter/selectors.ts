export const X_SELECTORS = {
  post: 'article[data-testid="tweet"]',
  postText: '[data-testid="tweetText"]',
  replyAction: '[data-testid="reply"]',
  actionGroup: '[role="group"]',
  userName: '[data-testid="User-Name"]',
  statusLink: 'a[href*="/status/"]',
} as const;

export const POSTMUSE_MOUNT_ATTRIBUTE = "data-postmuse-mounted";
export const POSTMUSE_HOST_ATTRIBUTE = "data-postmuse-host";
