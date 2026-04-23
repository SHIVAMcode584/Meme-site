export async function prepareMemeDeletion(supabase, memeId) {
  if (!memeId) return [];

  const callRpc = async () => {
    const { data, error } = await supabase.rpc("admin_delete_meme", {
      _meme_id: memeId,
    });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  };

  const fallbackClientDelete = async () => {
    const { data: relatedReports, error: reportLookupError } = await supabase
      .from("reports")
      .select("id")
      .eq("meme_id", memeId);

    if (reportLookupError) {
      throw reportLookupError;
    }

    const cleanupSteps = [
      supabase.from("likes").delete().eq("meme_id", memeId),
      supabase.from("comments").delete().eq("meme_id", memeId),
      supabase.from("notifications").delete().eq("meme_id", memeId),
      supabase.from("reports").update({ status: "removed" }).eq("meme_id", memeId),
      supabase.from("meme-table").delete().eq("id", memeId),
    ];

    for (const step of cleanupSteps) {
      const { error: stepError } = await step;
      if (stepError) {
        throw stepError;
      }
    }

    return (relatedReports || []).map((report) => report.id);
  };

  try {
    return await callRpc();
  } catch (error) {
    const rpcMissing =
      error?.code === "PGRST202" ||
      error?.status === 404 ||
      /could not find the function|schema cache/i.test(error?.message || "");

    if (!rpcMissing) {
      throw error;
    }

    return fallbackClientDelete();
  }
}
