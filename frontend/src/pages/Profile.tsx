import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <div className="p-8 text-gray-500">No user profile found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto card space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Name</p>
            <p className="font-medium text-gray-900">{user.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{user.email}</p>
          </div>
          <div>
            <p className="text-gray-500">Role</p>
            <p className="font-medium text-gray-900">{user.role}</p>
          </div>
          <div>
            <p className="text-gray-500">User Type</p>
            <p className="font-medium text-gray-900">{user.user_type}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
