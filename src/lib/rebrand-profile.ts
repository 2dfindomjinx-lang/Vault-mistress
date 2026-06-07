export const rebrandProfile = {
  avatarPath: "/rebrand/avatar.png",
  bannerPath: "/rebrand/header.png",
  bio: "2D Findom pup of Principessa. Her devoted digital pig and wallet. I serve, tribute and worship her completely. throne.com/principessa2dfd",
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
