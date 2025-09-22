import React, { useState, useRef } from 'react';
import { User } from '../types';
import { auth, storage } from '../services/firebase';
import Spinner from './ui/Spinner';
import { UserIcon } from './icons';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose, user }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.photoURL);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError("Image size should not exceed 2MB.");
        return;
      }
      setError('');
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      let photoURL = user.photoURL;

      if (photoFile) {
        const storageRef = storage.ref(`profilePictures/${user.uid}/${photoFile.name}`);
        const uploadTask = await storageRef.put(photoFile);
        photoURL = await uploadTask.ref.getDownloadURL();
      }

      await user.updateProfile({
        displayName,
        photoURL,
      });
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-md m-4 border border-base-300">
        <h2 className="text-2xl font-bold mb-6 text-base-content">Profile Settings</h2>
        
        {error && <p className="bg-red-500/20 text-red-400 text-sm p-3 rounded-md mb-4 border border-red-500/30">{error}</p>}
        
        <div className="flex items-center space-x-4 mb-6">
            <div className="relative">
                {previewUrl ? (
                    <img src={previewUrl} alt="Profile preview" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                    <div className="w-20 h-20 rounded-full bg-base-300 flex items-center justify-center">
                        <UserIcon className="w-10 h-10 text-neutral" />
                    </div>
                )}
            </div>
            <div>
                 <input type="file" accept="image/png, image/jpeg" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                    Upload Photo
                </button>
                <p className="text-xs text-neutral mt-2">PNG or JPG, max 2MB.</p>
            </div>
        </div>

        <div className="mb-6">
          <label htmlFor="displayName" className="block text-sm font-medium text-neutral mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-base-300 border border-base-300/50 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors disabled:bg-primary/50 flex items-center justify-center w-28"
          >
            {isSaving ? <Spinner size="sm"/> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsModal;