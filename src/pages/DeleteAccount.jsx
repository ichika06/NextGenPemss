import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext' // Adjust the import path as needed

const DeleteUserAccount = () => {
  const { deleteUserById, findUserByIdField, currentUserData } = useAuth()
  
  const [userId, setUserId] = useState('')
  const [userToDelete, setUserToDelete] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('') // 'success', 'error', 'info', 'warning'
  const [deletionResult, setDeletionResult] = useState(null)

  // Check if current user has admin permissions
  const hasDeletePermission = currentUserData && 
    (currentUserData.role === 'admin' || currentUserData.accessLevel === 'super' || currentUserData.role === 'registrar')

  const handleSearchUser = async () => {
    if (!userId.trim()) {
      setMessage('Please enter a user ID')
      setMessageType('error')
      return
    }

    setSearching(true)
    setMessage('')
    setUserToDelete(null)
    setShowConfirmation(false)
    setDeletionResult(null)

    try {
      const foundUser = await findUserByIdField(userId.trim())
      
      if (foundUser) {
        setUserToDelete(foundUser)
        setMessage(`User found: ${foundUser.name} (${foundUser.email})`)
        setMessageType('info')
      } else {
        setMessage('User not found with the provided ID')
        setMessageType('error')
      }
    } catch (error) {
      setMessage(`Error searching user: ${error.message}`)
      setMessageType('error')
    } finally {
      setSearching(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    // Verify confirmation input
    if (confirmationInput !== 'DELETE') {
      setMessage('Please type "DELETE" to confirm')
      setMessageType('error')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await deleteUserById(userToDelete.uid)
      
      if (result.success) {
        setDeletionResult(result)
        
        let successMessage = `User "${result.deletedUser.name}" (${result.deletedUser.email}) has been successfully deleted from the system.`
        
        if (result.warning) {
          successMessage += ` Note: ${result.warning}`
        }
        
        setMessage(successMessage)
        setMessageType('warning') // Use warning type to show the auth account limitation
        
        // Reset form
        setUserId('')
        setUserToDelete(null)
        setShowConfirmation(false)
        setConfirmationInput('')
      }
    } catch (error) {
      setMessage(`Error deleting user: ${error.message}`)
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelDelete = () => {
    setShowConfirmation(false)
    setConfirmationInput('')
    setMessage('')
  }

  const resetForm = () => {
    setUserId('')
    setUserToDelete(null)
    setShowConfirmation(false)
    setConfirmationInput('')
    setMessage('')
    setDeletionResult(null)
  }

  if (!hasDeletePermission) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to delete user accounts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Delete User Account</h2>
        <p className="text-gray-600">
          Search for a user by their ID and delete their account permanently.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
          <p className="text-red-700 text-sm font-medium">
            ⚠️ Warning: This action cannot be undone. All user data will be permanently deleted.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
          <p className="text-amber-700 text-sm">
            <strong>Note:</strong> This will delete the user's data from our system, but their Firebase Authentication account may remain active and require manual cleanup.
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="mb-6">
        <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
          User ID (Student ID, Teacher ID, Employee ID, Admin ID, or UID)
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter user ID (e.g., UA202400217, 20161589)"
            disabled={searching || loading}
          />
          <button
            onClick={handleSearchUser}
            disabled={searching || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded-md ${
          messageType === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
          messageType === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
          messageType === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
          'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          <div className="whitespace-pre-line">{message}</div>
        </div>
      )}

      {/* Deletion Result Summary */}
      {deletionResult && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4 border">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Deletion Summary</h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Deleted User:</span> {deletionResult.deletedUser.name}</div>
            <div><span className="font-medium">Email:</span> {deletionResult.deletedUser.email}</div>
            <div><span className="font-medium">Role:</span> {deletionResult.deletedUser.role}</div>
            <div><span className="font-medium">User ID:</span> {deletionResult.deletedUser.uid}</div>
            <div className="mt-3 p-2 bg-amber-100 rounded border border-amber-200">
              <p className="text-amber-800 text-xs">
                <strong>Action Required:</strong> The Firebase Authentication account for {deletionResult.deletedUser.email} still exists. 
                To completely remove access, manually delete this email from Firebase Authentication console.
              </p>
            </div>
          </div>
          
          <button
            onClick={resetForm}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Delete Another User
          </button>
        </div>
      )}

      {/* User Details */}
      {userToDelete && !showConfirmation && !deletionResult && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4 border">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">User Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="font-medium">Name:</span> {userToDelete.name}</div>
            <div><span className="font-medium">Email:</span> {userToDelete.email}</div>
            <div><span className="font-medium">Role:</span> {userToDelete.role}</div>
            {userToDelete.studentId && (
              <div><span className="font-medium">Student ID:</span> {userToDelete.studentId}</div>
            )}
            {userToDelete.teacherId && (
              <div><span className="font-medium">Teacher ID:</span> {userToDelete.teacherId}</div>
            )}
            {userToDelete.employeeId && (
              <div><span className="font-medium">Employee ID:</span> {userToDelete.employeeId}</div>
            )}
            {userToDelete.adminId && (
              <div><span className="font-medium">Admin ID:</span> {userToDelete.adminId}</div>
            )}
            {userToDelete.course && (
              <div><span className="font-medium">Course:</span> {userToDelete.course}</div>
            )}
            {userToDelete.section && (
              <div><span className="font-medium">Section:</span> {userToDelete.section}</div>
            )}
            {userToDelete.department && (
              <div><span className="font-medium">Department:</span> {userToDelete.department}</div>
            )}
            {userToDelete.position && (
              <div><span className="font-medium">Position:</span> {userToDelete.position}</div>
            )}
            {userToDelete.office && (
              <div><span className="font-medium">Office:</span> {userToDelete.office}</div>
            )}
            <div><span className="font-medium">Created:</span> {new Date(userToDelete.createdAt).toLocaleDateString()}</div>
          </div>
          
          <div className="mt-4 p-3 bg-red-100 rounded border border-red-200">
            <p className="text-red-800 text-sm">
              <strong>Email to be processed:</strong> {userToDelete.email}
              <br />
              <span className="text-xs">This email will be logged in the deletion audit trail.</span>
            </p>
          </div>
          
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setShowConfirmation(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Delete This User
            </button>
            <button
              onClick={() => {
                setUserToDelete(null)
                setUserId('')
                setMessage('')
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Section */}
      {showConfirmation && userToDelete && !deletionResult && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-3">Confirm Deletion</h3>
          <div className="space-y-2 text-red-700 mb-4">
            <p>You are about to permanently delete the account for:</p>
            <div className="bg-white p-3 rounded border border-red-300">
              <div><strong>Name:</strong> {userToDelete.name}</div>
              <div><strong>Email:</strong> {userToDelete.email}</div>
              <div><strong>Role:</strong> {userToDelete.role}</div>
            </div>
            <p className="font-medium">This action cannot be undone.</p>
          </div>
          
          <div className="mb-4">
            <label htmlFor="confirmation" className="block text-sm font-medium text-red-700 mb-2">
              Type "DELETE" to confirm:
            </label>
            <input
              type="text"
              id="confirmation"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Type DELETE here"
              disabled={loading}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDeleteUser}
              disabled={loading || confirmationInput !== 'DELETE'}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting...' : 'Delete User Permanently'}
            </button>
            <button
              onClick={handleCancelDelete}
              disabled={loading}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeleteUserAccount