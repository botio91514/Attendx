import React, { useState, useRef } from 'react';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ProfilePhotoUploaderProps {
  currentPhoto?: string | null;
  onUploadSuccess: (newPhotoUrl: string) => void;
  size?: number;
  editable?: boolean;
}

const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({ 
  currentPhoto, 
  onUploadSuccess, 
  size = 120,
  editable = true
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const BASE_URL = API_URL.replace('/api', '');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG and WEBP images are allowed');
      return;
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    const formData = new FormData();
    formData.append('photo', file);

    setIsUploading(true);
    try {
      const token = localStorage.getItem('attendx_token');
      const response = await fetch(`${API_URL}/profile/me/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        onUploadSuccess(data.photoUrl);
        toast.success('Profile photo updated successfully');
        setPreview(null);
      } else {
        toast.error(data.message || 'Upload failed');
        setPreview(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Network error during upload');
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const getPhotoUrl = () => {
    if (preview) return preview;
    if (currentPhoto) {
      // If it's a relative path starting with uploads/
      if (currentPhoto.startsWith('uploads/')) {
        return `${BASE_URL}/${currentPhoto}`;
      }
      return currentPhoto;
    }
    return null;
  };

  const photoUrl = getPhotoUrl();

  return (
    <div 
      className="relative group mx-auto"
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="w-full h-full rounded-full border-4 border-glass-border bg-secondary/50 flex items-center justify-center overflow-hidden shadow-2xl relative"
      >
        {photoUrl ? (
          <img 
            src={photoUrl} 
            alt="Profile" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-primary font-display font-bold text-4xl">
            ?
          </div>
        )}

        {/* Overlay for hover/uploading */}
        <AnimatePresence>
          {(isHovered || isUploading) && editable && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center cursor-pointer transition-colors"
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-white mb-1" />
                  <span className="text-[10px] text-white font-medium uppercase tracking-wider">Change Photo</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />
      
      {editable && (
        <div className="absolute -bottom-1 -right-1 bg-primary p-1.5 rounded-full shadow-lg border-2 border-background">
          <Upload className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
    </div>
  );
};

export default ProfilePhotoUploader;
