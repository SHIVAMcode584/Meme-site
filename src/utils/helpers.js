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

  if (selectedCategory && selectedCategory !== "All") {
    filtered = filtered.filter((meme) => 
      meme.category?.toLowerCase().trim() === selectedCategory.toLowerCase().trim()
    );
  }

  // 2. Filter by Search Query
  const query = search.toLowerCase().trim();
  if (!query) return filtered;
  
  const queryWords = query.split(/\s+/).filter(Boolean);

  return filtered.filter((meme) => {
    const keywordsArray = Array.isArray(meme.keywords) ? meme.keywords : [];
    const searchableText = `
      ${meme.title || ""}
      ${keywordsArray.join(" ")}
      ${meme.mood || ""}
      ${meme.category || ""}
    `.toLowerCase();

    // Use 'every' so that multi-word searches are more accurate
    return queryWords.every((word) => searchableText.includes(word));
  });
}