export async function uploadImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (data.url) {
      return data.url;
    } else {
      throw new Error(data.error || "Görsel yüklenemedi");
    }
  } catch (error: any) {
    console.error("Error uploading image to Cloudinary:", error);
    throw error;
  }
}
