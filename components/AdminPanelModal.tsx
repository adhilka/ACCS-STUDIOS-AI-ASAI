import React, { useState } from 'react';
import { ApiPoolConfig, ApiPoolKey, AiProvider, AdminUser } from '../types';
import { DeleteIcon, KeyIcon, UsersIcon } from './icons';
import Spinner from './ui/Spinner';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolConfig: ApiPoolConfig;
  poolKeys: ApiPoolKey[];
  onSaveConfig: (config: ApiPoolConfig) => void;
  onAddKey: (provider: AiProvider, key: string) => void;
  onDeleteKey: (keyId: string) => void;
  stats: { users: number; projects: number } | null;
  users: AdminUser[];
}

const providers: AiProvider[] = ['gemini', 'openrouter', 'groq'];

const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  poolConfig,
  poolKeys,
  onSaveConfig,
  onAddKey,
  onDeleteKey,
  stats,
  users,
}) => {
  const [newKey, setNewKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>('gemini');
  const [activeTab, setActiveTab] = useState<'pool' | 'users'>('pool');

  if (!isOpen) return null;

  const handleToggle = () => {
    onSaveConfig({ ...poolConfig, isEnabled: !poolConfig.isEnabled });
  };

  const handleAddKey = () => {
    if (newKey.trim()) {
      onAddKey(selectedProvider, newKey.trim());
      setNewKey('');
    }
  };
  
  // FIX: Updated the type for the 'value' prop to allow React nodes, enabling the use of the Spinner component.
  const StatCard: React.FC<{ title: string; value: React.ReactNode; icon: React.ReactNode }> = ({ title, value, icon }) => (
      <div className="bg-base-100 p-4 rounded-lg flex items-center gap-4">
        {icon}
        <div>
            <p className="text-sm text-neutral">{title}</p>
            <p className="text-2xl font-bold text-base-content">{value}</p>
        </div>
      </div>
  );

  const tabClasses = (tab: 'pool' | 'users') => 
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
      activeTab === tab 
      ? 'border-primary text-primary' 
      : 'border-transparent text-neutral hover:text-base-content'
    }`;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-4xl m-4 border border-base-300 flex flex-col" style={{height: '90vh'}}>
        <h2 className="text-2xl font-bold mb-2 text-base-content">Admin Panel</h2>
        <p className="text-sm text-neutral mb-6">Manage global settings, API keys, and users.</p>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <StatCard 
                title="Total Users" 
                value={stats ? stats.users : <Spinner size="sm" />} 
                icon={<div className="p-3 bg-blue-500/20 rounded-lg text-blue-400"><UsersIcon className="w-6 h-6" /></div>}
            />
            <StatCard 
                title="Total Projects" 
                value={stats ? stats.projects : <Spinner size="sm" />} 
                icon={<div className="p-3 bg-green-500/20 rounded-lg text-green-400"><KeyIcon className="w-6 h-6" /></div>}
            />
        </div>

        {/* Tabs */}
        <div className="border-b border-base-300">
            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                <button className={tabClasses('pool')} onClick={() => setActiveTab('pool')}>API Key Pool</button>
                <button className={tabClasses('users')} onClick={() => setActiveTab('users')}>Users</button>
            </nav>
        </div>

        <div className="flex-grow flex flex-col overflow-hidden mt-4">
        {activeTab === 'pool' && (
            <>
                <div className="mb-6 bg-base-300/50 p-4 rounded-lg border border-base-300">
                    <h3 className="font-semibold text-lg mb-2">API Key Pooling</h3>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-neutral">Allow users without their own API keys to use keys from this pool.</p>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={poolConfig.isEnabled} onChange={handleToggle} className="sr-only peer" />
                          <div className="w-11 h-6 bg-base-100 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>
                
                <div className="mb-4">
                    <h3 className="font-semibold text-lg mb-2">Add New Key to Pool</h3>
                    <div className="flex gap-2">
                        <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as AiProvider)} className="bg-base-100 border border-base-300 rounded-md px-3 text-sm focus:outline-none">
                            {providers.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                        </select>
                        <input
                            type="password"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder="Paste new API key here..."
                            className="flex-grow bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button onClick={handleAddKey} className="px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors">
                            Add Key
                        </button>
                    </div>
                </div>

                <div className="flex-grow flex flex-col overflow-hidden mt-4">
                    <h3 className="font-semibold text-lg mb-2">Manage Pooled Keys</h3>
                    <div className="flex-grow overflow-y-auto bg-base-100 rounded-lg border border-base-300 p-3">
                         {poolKeys.length === 0 ? (
                            <p className="text-sm text-neutral text-center py-8">No keys in the pool.</p>
                         ) : (
                            <ul className="space-y-2">
                                {poolKeys.map(key => (
                                    <li key={key.id} className="flex items-center justify-between bg-base-200 p-2 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <KeyIcon className="w-5 h-5 text-neutral" />
                                            <div>
                                                <p className="font-mono text-sm text-base-content">
                                                    <span className="font-bold text-primary">{key.provider}</span> - ...{key.key.slice(-4)}
                                                </p>
                                                <p className="text-xs text-neutral">Added on {key.addedAt?.toDate().toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => onDeleteKey(key.id)} className="p-1 hover:bg-red-500/20 rounded">
                                            <DeleteIcon className="w-4 h-4 text-red-500"/>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                         )}
                    </div>
                </div>
            </>
        )}
        {activeTab === 'users' && (
             <div className="flex-grow overflow-y-auto bg-base-100 rounded-lg border border-base-300 p-3">
                 {users.length === 0 ? (
                    <p className="text-sm text-neutral text-center py-8">No user data available.</p>
                 ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-base-300/50">
                            <tr>
                                <th className="p-2">Email</th>
                                <th className="p-2">User ID</th>
                                <th className="p-2">Signed Up</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.uid} className="border-b border-base-300">
                                    <td className="p-2">{user.email}</td>
                                    <td className="p-2 font-mono text-neutral">{user.uid}</td>
                                    <td className="p-2">{user.createdAt?.toDate().toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 )}
            </div>
        )}
        </div>


        <div className="flex justify-end mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanelModal;