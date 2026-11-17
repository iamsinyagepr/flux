// flux dev's stand-in for Studio's console API (upskaleapp/src/api/client.ts).
// The editors use it only to upload an image someone picks: flux dev saves
// it into the project's public/ folder and answers with its address there.
import { uploadImage } from "../../host/channel";

export const api = {
  uploadStudioMedia(file: File): Promise<{ url: string }> {
    return uploadImage(file);
  },
};
