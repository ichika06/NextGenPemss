/**
 * A service class for managing user storage in Firebase Storage.
 */
// src/services/UserStorageService.js
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    listAll, 
    deleteObject 
  } from "firebase/storage";
  
  // Initialize Firebase Storage
  const storage = getStorage();
  
  class UserStorageService {
    // Create user's personal storage folder and structure
    async createUserStorageFolders(uid, role) {
      try {
        // We don't actually create folders in Firebase Storage as it's object-based
        // Instead, we create a placeholder file to mark the folder structure
        const folderStructure = this.getFolderStructureByRole(role);
        const createPromises = [];
        
        // Create placeholder files for each folder
        for (const folder of folderStructure) {
          const placeholderPath = `users/${uid}/${folder}/.placeholder`;
          const placeholderRef = ref(storage, placeholderPath);
          
          // Create a tiny placeholder file with metadata
          const placeholderBlob = new Blob([""], { type: "text/plain" });
          const metadata = {
            customMetadata: {
              createdAt: new Date().toISOString(),
              purpose: "folder_structure"
            }
          };
          
          createPromises.push(uploadBytes(placeholderRef, placeholderBlob, metadata));
        }
        
        // Wait for all placeholder files to be created
        await Promise.all(createPromises);
        
        return {
          success: true,
          folderStructure,
          storagePath: `users/${uid}/`
        };
      } catch (error) {
        console.error("Error creating user storage folders:", error);
        throw error;
      }
    }
    
    // Get appropriate folder structure based on user role
    getFolderStructureByRole(role) {
      const commonFolders = ["profile", "documents"];
      
      switch (role) {
        case "student":
          return [...commonFolders, "assignments", "grades", "certificates"];
        case "teacher":
          return [...commonFolders, "courses", "materials", "assignments", "grades"];
        case "registrar":
          return [...commonFolders, "records", "forms", "reports"];
        case "admin":
          return [...commonFolders, "system", "logs", "backups"];
        default:
          return commonFolders;
      }
    }
    
    // Upload profile image to user's storage
    async uploadProfileImage(uid, file) {
      if (!uid || !file) {
        throw new Error("User ID and file are required");
      }
      
      try {
        const fileExtension = file.name.split('.').pop();
        const imagePath = `users/${uid}/profile/profile-image.${fileExtension}`;
        const storageRef = ref(storage, imagePath);
        
        // Add metadata to the file
        const metadata = {
          contentType: file.type,
          customMetadata: {
            uploadedAt: new Date().toISOString(),
            originalFilename: file.name
          }
        };
        
        // Upload the file
        const snapshot = await uploadBytes(storageRef, file, metadata);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return {
          success: true,
          path: imagePath,
          url: downloadURL
        };
      } catch (error) {
        console.error("Error uploading profile image:", error);
        throw error;
      }
    }

    async updateProfileImage(uid, newFile, oldImagePath = null) {
      if (!uid || !newFile) {
        throw new Error("User ID and new file are required");
      }
      
      try {
        // If oldImagePath is provided, delete the old image first
        if (oldImagePath) {
          try {
            const oldImageRef = ref(storage, oldImagePath);
            await deleteObject(oldImageRef);
            console.log("Old profile image deleted successfully");
          } catch (deleteError) {
            // Log the error but don't throw - we still want to upload the new image
            console.warn("Failed to delete old profile image:", deleteError);
          }
        }
        
        const fileExtension = newFile.name.split('.').pop();
        const imagePath = `users/${uid}/profile/profile-image.${fileExtension}`;
        const storageRef = ref(storage, imagePath);
        
        // Add metadata to the file
        const metadata = {
          contentType: newFile.type,
          customMetadata: {
            uploadedAt: new Date().toISOString(),
            originalFilename: newFile.name,
            updatedAt: new Date().toISOString()
          }
        };
        
        // Upload the new file
        const snapshot = await uploadBytes(storageRef, newFile, metadata);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return {
          success: true,
          path: imagePath,
          url: downloadURL,
          updated: true
        };
      } catch (error) {
        console.error("Error updating profile image:", error);
        throw error;
      }
    }
    
    // Upload a document to user's storage
    async uploadUserDocument(uid, file, folderName = "documents") {
      if (!uid || !file) {
        throw new Error("User ID and file are required");
      }
      
      try {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `users/${uid}/${folderName}/${fileName}`;
        const storageRef = ref(storage, filePath);
        
        // Add metadata to the file
        const metadata = {
          contentType: file.type,
          customMetadata: {
            uploadedAt: new Date().toISOString(),
            originalFilename: file.name
          }
        };
        
        // Upload the file
        const snapshot = await uploadBytes(storageRef, file, metadata);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return {
          success: true,
          path: filePath,
          fileName,
          url: downloadURL
        };
      } catch (error) {
        console.error("Error uploading document:", error);
        throw error;
      }
    }
    
    // List all files in a user folder
    async listUserFiles(uid, folderName = "") {
      try {
        const directoryPath = `users/${uid}${folderName ? `/${folderName}` : ''}`;
        const directoryRef = ref(storage, directoryPath);
        
        const filesList = await listAll(directoryRef);
        
        // Get details for each file
        const filesPromises = filesList.items.map(async (fileRef) => {
          try {
            const url = await getDownloadURL(fileRef);
            return {
              name: fileRef.name,
              fullPath: fileRef.fullPath,
              url
            };
          } catch (error) {
            console.error(`Error getting URL for ${fileRef.fullPath}:`, error);
            return {
              name: fileRef.name,
              fullPath: fileRef.fullPath,
              error: "Failed to get URL"
            };
          }
        });
        
        // Get all folder references (prefixes)
        const folders = filesList.prefixes.map(prefix => ({
          name: prefix.name,
          fullPath: prefix.fullPath
        }));
        
        // Wait for all file details
        const files = await Promise.all(filesPromises);
        
        return {
          files: files.filter(file => !file.name.startsWith('.')), // Filter out placeholder files
          folders,
          path: directoryPath
        };
      } catch (error) {
        console.error("Error listing user files:", error);
        throw error;
      }
    }
    
    // Delete a file from user's storage
    async deleteUserFile(filePath) {
      try {
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);
        
        return {
          success: true,
          deletedPath: filePath
        };
      } catch (error) {
        console.error("Error deleting file:", error);
        throw error;
      }
    }
    
    // Clean up user's entire storage when account is deleted
    async deleteUserStorage(uid) {
      try {
        // List all files in user's directory
        const { files, folders } = await this.listUserFiles(uid);
        
        // Delete all files
        const deletePromises = files.map(file => this.deleteUserFile(file.fullPath));
        
        // For each folder, recursively delete its contents
        for (const folder of folders) {
          // Get folder name from path
          const folderName = folder.fullPath.split('/').pop();
          await this.deleteUserStorageFolder(uid, folderName);
        }
        
        // Wait for all files to be deleted
        await Promise.all(deletePromises);
        
        return {
          success: true,
          message: `All storage for user ${uid} deleted successfully`
        };
      } catch (error) {
        console.error("Error deleting user storage:", error);
        throw error;
      }
    }
    
    // Recursively delete a specific folder
    async deleteUserStorageFolder(uid, folderName) {
      try {
        const { files, folders } = await this.listUserFiles(uid, folderName);
        
        // Delete all files in this folder
        const deletePromises = files.map(file => this.deleteUserFile(file.fullPath));
        
        // Recursively delete subfolders
        for (const subfolder of folders) {
          const subfolderName = `${folderName}/${subfolder.name}`;
          await this.deleteUserStorageFolder(uid, subfolderName);
        }
        
        // Wait for all files to be deleted
        await Promise.all(deletePromises);
        
        return {
          success: true
        };
      } catch (error) {
        console.error(`Error deleting folder ${folderName}:`, error);
        throw error;
      }
    }
  }
  
  export default new UserStorageService();