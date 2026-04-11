export const categories = ["All", "Reply", "School", "Chat", "Reaction", "Funny"];

export const suggestions = [
  "friend acting rich",
  "teacher asking homework",
  "ab mai kya bolu",
  "ignored by crush",
  "no way",
  "awkward reply",
];

export function downloadImage(imageUrl, fileName) {
  const link = document.createElement("a");
  link.href = imageUrl;
  link.download = `${fileName}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function smartSearch(memes, search, selectedCategory) {
  let filtered = memes;

  if (selectedCategory !== "All") {
    filtered = filtered.filter((meme) => meme.category === selectedCategory);
  }

  if (!search.trim()) return filtered;

  const queryWords = search.toLowerCase().split(" ").filter(Boolean);

  return filtered.filter((meme) => {
    const searchableText = `
      ${meme.title}
      ${meme.keywords.join(" ")}
      ${meme.mood}
      ${meme.category}
    `.toLowerCase();

    return queryWords.some((word) => searchableText.includes(word));
  });
}