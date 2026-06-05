export const rebrandProfile = {
  avatarPath: "/rebrand/avatar.png",
  bannerPath: "/rebrand/header.png",
  bio: "Owned by my perfect @Principessa2dfd 💛 I serve her completely worship her. 🦮 Send to her http://throne.com/principessa2dfd",
  displayName: "Principessa's Slut",
  location: "Under Principessa's Heels",
  website: "https://vault-mistress.vercel.app",
};

export function getRebrandProfileWithAssetUrls(origin: string) {
  return {
    avatarUrl: new URL(rebrandProfile.avatarPath, origin).toString(),
    bannerUrl: new URL(rebrandProfile.bannerPath, origin).toString(),
    bio: rebrandProfile.bio,
    displayName: rebrandProfile.displayName,
    location: rebrandProfile.location,
    website: rebrandProfile.website,
  };
}
