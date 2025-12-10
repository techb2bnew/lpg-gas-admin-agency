// import React, { useState } from "react";
// import axios from "axios";
// import { useAuth } from "@/context/auth-context";

// export default function BannerUpload() {
//   const { token, handleApiError } = useAuth();

//   const [images, setImages] = useState([]);
//   const maxImages = 5;

//   const handleImageSelect = (e) => {
//     const files = Array.from(e.target.files);

//     const total = [...images, ...files].slice(0, maxImages);
//     setImages(total);
//   };

//   const handleUpload = async () => {
//     if (images.length === 0) {
//       alert("Please upload at least 1 image");
//       return;
//     }

//     const formData = new FormData();
//     images.forEach((img) => {
//      formData.append("images", img);
//     });

//     try {
//       const res = await axios.post(
//         `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/banners`,
//         formData,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             "ngrok-skip-browser-warning": "true",
//           },
//         }
//       );

//       alert("Banners Uploaded Successfully!");
//       console.log(res.data);
//     } catch (err) {
//       console.log(err);
//       alert("Error uploading banners");
//     }
//   };

//   return (
//     <div className="p-4 border rounded-md bg-white shadow-md">
//       <h3 className="text-lg font-bold mb-3">Upload Banner Images</h3>

//       <input
//         type="file"
//         multiple
//         accept="image/*"
//         onChange={handleImageSelect}
//       />

//       {/* Preview Section */}
//       <div className="grid grid-cols-5 gap-3 mt-4">
//         {images.map((img, index) => (
//           <div key={index} className="w-20 h-20 border rounded overflow-hidden">
//             <img
//               src={URL.createObjectURL(img)}
//               alt="banner"
//               className="w-full h-full object-cover"
//             />
//           </div>
//         ))}
//       </div>

//       <button
//         onClick={handleUpload}
//         // className="flex-1"
//         className="mt-4 flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
//       >
//         Upload Banners
//       </button>
//     </div>
//   );
// }
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/auth-context";
import { Fetch } from "socket.io-client";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";

export default function BannerUpload() {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState([]); // new images to upload
  const [serverImages, setServerImages] = useState([]); // saved banners from backend
  const [bannerId, setBannerId] = useState([]); // saved banners from backend

  const maxImages = 5;
  console.log("serverImagesserverImages", serverImages);

  const fetchBanners = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/banners`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      console.log("RAW RES:", res);

      // 💥 Fetch se JSON lene ka sahi method
      const data = await res.json();

      console.log("PARSED JSON:", data.data?.banners?.[0]);
      if (data?.data?.banners) {
        setBannerId(data.data?.banners?.[0]?.id);
        setServerImages(data?.data?.banners?.[0]?.images);
      } else {
        console.log("Invalid data:", data);
      }
    } catch (err) {
      console.log("Fetch Error:", err);
    } finally {
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // Handle selecting new images
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const total = [...images, ...files].slice(0, maxImages);
    setImages(total);
  };

  // Upload new banners
  const handleUpload = async () => {
    if (images.length === 0) {
      alert("Please upload at least 1 image");
      return;
    }

    const formData = new FormData();
    images.forEach((img) => {
      formData.append("images", img); // FIELD NAME MUST MATCH BACKEND
    });
    setSaving(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/banners`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      alert("Banners Uploaded Successfully!");
      setImages([]);
      fetchBanners();
    } catch (err) {
      console.log(err);
      setSaving(false);
      alert("Error uploading banners");
    } finally {
      setSaving(false);
    }
  };

  // DELETE banner
  const handleDelete = async (id: any) => {
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/banners/${bannerId}/image/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setServerImages(serverImages.filter((img: any) => img.id !== id));
    } catch (err) {
      console.log(err);
      alert("Delete failed");
    }
  };

  // UPDATE banner (PUT)
  const handleUpdate = async (id, file) => {
    const formData = new FormData();
    formData.append("images", file);

    try {
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/banners/${id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Update UI instantly
      const updatedUrl = res?.data?.data?.banner?.images[0];

      setServerImages((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, url: updatedUrl } : item
        )
      );
    } catch (err) {
      console.log(err);
      alert("Update failed!");
    }
  };

  return (
    <div className="p-4 border rounded-md bg-white shadow-md">
      <h3 className="text-lg font-bold mb-3">Upload Banner Images</h3>

      {/* Upload input */}
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageSelect}
      />

      {/* Preview selected images */}
      <div className="grid grid-cols-5 gap-3 mt-4">
        {images.map((img, index) => (
          <div
            key={index}
            className="relative w-20 h-20 border rounded overflow-hidden"
          >
            {/* Delete selected image */}
            <button
              onClick={() => {
                const temp = [...images];
                temp.splice(index, 1);
                setImages(temp);
              }}
              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >
              ✕
            </button>

            <img
              src={URL.createObjectURL(img)}
              alt="banner"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Upload btn */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleUpload}
          // disabled={saving || !amount}
          className="flex-1"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>Upload Banners</>
          )}
        </Button>
      </div>

      <hr className="my-6" />

      {/* Already saved banners */}
      <h3 className="text-lg font-bold mb-3">Saved Banners</h3>

      <div className="grid grid-cols-5 gap-3">
        {serverImages?.map((img: any) => (
          <div
            key={img?.id}
            className="relative w-20 h-20 border rounded overflow-hidden"
          >
            {/* DELETE BUTTON */}
            <button
              onClick={() => handleDelete(img.id)}
              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >
              ✕
            </button>

            {/* UPDATE BUTTON */}
            {/* <label className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1 py-[1px] rounded cursor-pointer">
              Edit
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpdate(img._id, e.target.files[0])}
              />
            </label> */}

            <img
              src={img?.url}
              alt="banner"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
