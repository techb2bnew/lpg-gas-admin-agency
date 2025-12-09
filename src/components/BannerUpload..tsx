import React, { useState } from "react";
import axios from "axios";

export default function BannerUpload() {
  const [images, setImages] = useState([]);
  const maxImages = 5;

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);

    const total = [...images, ...files].slice(0, maxImages);
    setImages(total);
  };

  const handleUpload = async () => {
    if (images.length === 0) {
      alert("Please upload at least 1 image");
      return;
    }

    const formData = new FormData();
    images.forEach((img) => {
      formData.append("banners", img);
    });

    try {
      const res = await axios.post(
        "https://your-backend-url.com/api/upload-banners",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      alert("Banners Uploaded Successfully!");
      console.log(res.data);
    } catch (err) {
      console.log(err);
      alert("Error uploading banners");
    }
  };

  return (
    <div className="p-4 border rounded-md bg-white shadow-md">
      <h3 className="text-lg font-bold mb-3">Upload Banner Images</h3>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageSelect}
      />

      {/* Preview Section */}
      <div className="grid grid-cols-5 gap-3 mt-4">
        {images.map((img, index) => (
          <div key={index} className="w-20 h-20 border rounded overflow-hidden">
            <img
              src={URL.createObjectURL(img)}
              alt="banner"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleUpload}
        // className="flex-1"
        className="mt-4 flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Upload Banners
      </button>
    </div>
  );
}
