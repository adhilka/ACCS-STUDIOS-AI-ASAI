import React, { useState } from 'react';
import { ApiPoolConfig, ApiPoolKey, AiProvider, AdminUser, AdminSettings, AdminStats, PlatformError } from '../types';
import { DeleteIcon, KeyIcon, UsersIcon, SaveIcon, CheckIcon, CodeIcon, FileIcon, DatabaseIcon, SettingsIcon, TokenIcon, ExclamationTriangleIcon } from './icons';
import Spinner from './ui/Spinner';
import { formatTokens } from '../utils/formatters';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolConfig: ApiPoolConfig;
  poolKeys: ApiPoolKey[];
  onSaveConfig: (config: ApiPoolConfig) => void;
  onAddKey: (provider: AiProvider, key: string) => Promise<void>;
  onDeleteKey: (keyId: string) => void;
  onUpdateUserTokens: (userId: string, newBalance: number) => void;
  onSaveAdminSettings: (settings: AdminSettings) => void;
  stats: AdminStats | null;
  users: AdminUser[];
  adminSettings: AdminSettings;
  platformErrors: PlatformError[];
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
  onUpdateUserTokens,
  onSaveAdminSettings,
  stats,
  users,
  adminSettings,
  platformErrors,
}) => {
  const [newKey, setNewKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>('gemini');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings' | 'errors'>('dashboard');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editTokenValue, setEditTokenValue] = useState<string>('');
  const [dailyReward, setDailyReward] = useState(adminSettings.dailyTokenReward.toString());
  const [errorFilter, setErrorFilter] = useState('');

  if (!isOpen) return null;

  const handleToggle = () => {
    onSaveConfig({ ...poolConfig, isEnabled: !poolConfig.isEnabled });
  };

  const handleAddKey = async () => {
    if (newKey.trim()) {
      try {
        await onAddKey(selectedProvider, newKey.trim());
        setNewKey('');
      } catch (e) {
        alert(`Failed to add key: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUserId(user.uid);
    setEditTokenValue(user.tokenBalance?.toString() || '0');
  };

  const handleSaveUserTokens = () => {
    if (editingUserId) {
        const newBalance = parseInt(editTokenValue, 10);
        if (!isNaN(newBalance)) {
            onUpdateUserTokens(editingUserId, newBalance);
        }
        setEditingUserId(null);
        setEditTokenValue('');
    }
  };

  const handleSaveSettings = () => {
    const reward = parseInt(dailyReward, 10);
    if (!isNaN(reward)) {
        onSaveAdminSettings({ dailyTokenReward: reward });
        alert("Settings saved!");
    } else {
        alert("Invalid daily reward amount.");
    }
  };
  
    const formatBytes = (bytes: number, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
  
  const StatCard: React.FC<{ title: string; value: React.ReactNode; icon: React.ReactNode }> = ({ title, value, icon }) => (
      <div className="bg-base-100 p-4 rounded-lg flex items-center gap-4 border border-base-300">
        {icon}
        <div>
            <p className="text-sm text-neutral">{title}</p>
            <div className="text-2xl font-bold text-base-content">{value}</div>
        </div>
      </div>
  );

  const tabClasses = (tab: 'dashboard' | 'users' | 'settings' | 'errors') => 
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
      activeTab === tab 
      ? 'border-primary text-primary' 
      : 'border-transparent text-neutral hover:text-base-content'
    }`;
    
    const filteredErrors = platformErrors.filter(e => 
        e.errorMessage.toLowerCase().includes(errorFilter.toLowerCase()) ||
        e.userEmail?.toLowerCase().includes(errorFilter.toLowerCase()) ||
        e.provider?.toLowerCase().includes(errorFilter.toLowerCase())
    );


  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
      <div className="bg-base-200 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-sm sm:max-w-xl md:max-w-3xl lg:max-w-5xl border border-base-300 flex flex-col h-[90vh]">
        <h2 className="text-2xl font-bold mb-2 text-base-content">Admin Panel</h2>
        <p className="text-sm text-neutral mb-6">Manage global settings, API keys, and users.</p>
        
        {/* Tabs */}
        <div className="border-b border-base-300">
            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                <button className={tabClasses('dashboard')} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
                <button className={tabClasses('users')} onClick={() => setActiveTab('users')}>Users</button>
                <button className={tabClasses('settings')} onClick={() => setActiveTab('settings')}>Settings</button>
                 <button className={tabClasses('errors')} onClick={() => setActiveTab('errors')}>
                    <ExclamationTriangleIcon className="w-4 h-4" /> Errors
                    {platformErrors.length > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{platformErrors.length}</span>
                    )}
                 </button>
            </nav>
        </div>

        <div className="flex-grow flex flex-col overflow-y-auto mt-6">
        {activeTab === 'dashboard' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard 
                    title="Total Users" 
                    value={stats ? stats.userCount : <Spinner size="sm" />} 
                    icon={<div className="p-3 bg-blue-500/20 rounded-lg text-blue-400"><UsersIcon className="w-6 h-6" /></div>}
                />
                <StatCard 
                    title="Total Projects" 
                    value={stats ? stats.projectCount : <Spinner size="sm" />} 
                    icon={<div className="p-3 bg-green-500/20 rounded-lg text-green-400"><CodeIcon className="w-6 h-6" /></div>}
                />
                <StatCard 
                    title="Total Files" 
                    value={stats ? stats.totalFiles : <Spinner size="sm" />} 
                    icon={<div className="p-3 bg-sky-500/20 rounded-lg text-sky-400"><FileIcon className="w-6 h-6" /></div>}
                />
                <StatCard 
                    title="Total Data Stored" 
                    value={stats ? formatBytes(stats.totalDataStored) : <Spinner size="sm" />} 
                    icon={<div className="p-3 bg-indigo-500/20 rounded-lg text-indigo-400"><DatabaseIcon className="w-6 h-6" /></div>}
                />
             </div>
        )}
        {activeTab === 'settings' && (
            <div className='space-y-6'>
                <div className="bg-base-300/50 p-4 rounded-lg border border-base-300">
                    <h3 className="font-semibold text-lg mb-2">Platform Settings</h3>
                     <div className="flex items-center justify-between">
                        <label htmlFor="daily-reward" className="text-sm text-neutral">Daily Token Reward</label>
                        <input
                            id="daily-reward"
                            type="number"
                            value={dailyReward}
                            onChange={(e) => setDailyReward(e.target.value)}
                            className="bg-base-100 border border-base-300 rounded-md py-1 px-2 text-base-content w-40"
                        />
                    </div>
                     <div className="flex justify-end mt-4">
                        <button onClick={handleSaveSettings} className="px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white text-sm font-semibold transition-colors">
                            Save Settings
                        </button>
                    </div>
                </div>
                <div className="bg-base-300/50 p-4 rounded-lg border border-base-300">
                    <h3 className="font-semibold text-lg mb-2">API Key Pooling</h3>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-neutral">Allow users without their own API keys to use keys from this pool.</p>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={poolConfig.isEnabled} onChange={handleToggle} className="sr-only peer" />
                          <div className="w-11 h-6 bg-base-100 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>
                 <div>
                    <h3 className="font-semibold text-lg mb-2">Add New Key to Pool</h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as AiProvider)} className="w-full sm:w-auto bg-base-100 border border-base-300 rounded-md px-3 h-10 text-sm focus:outline-none">
                            {providers.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                        </select>
                        <input
                            type="password"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder="Paste new API key here..."
                            className="flex-grow bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button onClick={handleAddKey} className="w-full sm:w-auto px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors">
                            Add Key
                        </button>
                    </div>
                </div>
                 <div>
                    <h3 className="font-semibold text-lg mb-2">Manage Pooled Keys</h3>
                    <div className="overflow-y-auto bg-base-100 rounded-lg border border-base-300 p-3 max-h-80">
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
                                                <p className="text-xs text-neutral">Added on {(key.addedAt instanceof Date ? key.addedAt : key.addedAt.toDate()).toLocaleDateString()}</p>
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
            </div>
        )}
        {activeTab === 'users' && (
             <div className="flex-grow overflow-auto bg-base-100 rounded-lg border border-base-300">
                 {users.length === 0 ? (
                    <p className="text-sm text-neutral text-center py-8">No user data available.</p>
                 ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-base-300/50 sticky top-0">
                                <tr>
                                    <th className="p-3">Email</th>
                                    <th className="p-3">Token Balance</th>
                                    <th className="p-3">Signed Up</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.uid} className="border-b border-base-300">
                                        <td className="p-3 whitespace-nowrap">{user.email}</td>
                                        <td className="p-3 font-mono whitespace-nowrap">
                                            {editingUserId === user.uid ? (
                                                <input 
                                                    type="number" 
                                                    value={editTokenValue} 
                                                    onChange={e => setEditTokenValue(e.target.value)} 
                                                    className="bg-base-300 rounded px-2 py-1 w-32"
                                                />
                                            ) : (
                                                formatTokens(user.tokenBalance || 0)
                                            )}
                                        </td>
                                        <td className="p-3 whitespace-nowrap">{user.createdAt?.toDate().toLocaleDateString()}</td>
                                        <td className="p-3 text-right whitespace-nowrap">
                                            {editingUserId === user.uid ? (
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={handleSaveUserTokens} className="p-1.5 hover:bg-green-500/20 rounded-md" title="Save">
                                                        <CheckIcon className="w-4 h-4 text-green-500"/>
                                                    </button>
                                                    <button onClick={() => setEditingUserId(null)} className="p-1.5 hover:bg-base-300 rounded-md" title="Cancel">
                                                        <span className="text-xs">X</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleEditUser(user)} className="text-xs text-primary hover:underline">
                                                    Edit Tokens
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 )}
            </div>
        )}
         {activeTab === 'errors' && (
             <div className="flex flex-col flex-grow overflow-hidden">
                <input
                    type="text"
                    value={errorFilter}
                    onChange={(e) => setErrorFilter(e.target.value)}
                    placeholder="Filter by error, user, or provider..."
                    className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                />
                 <div className="flex-grow overflow-y-auto bg-base-100 rounded-lg border border-base-300 p-2">
                     {filteredErrors.length === 0 ? (
                        <p className="text-sm text-neutral text-center py-8">No platform errors logged.</p>
                     ) : (
                        <ul className="space-y-2">
                            {filteredErrors.map(error => (
                                <li key={error.id} className="bg-base-200 p-3 rounded-md">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-neutral">
                                                {error.timestamp.toDate().toLocaleString()}
                                            </p>
                                            <p className="text-sm text-red-400 font-semibold break-words">{error.errorMessage}</p>
                                        </div>
                                        <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-1 rounded-full">{error.provider}</span>
                                    </div>
                                    <div className="text-xs text-neutral mt-2">
                                        <p><strong>User:</strong> {error.userEmail || error.userId}</p>
                                        <p><strong>Project ID:</strong> {error.projectId || 'N/A'}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                     )}
                </div>
            </div>
        )}
        </div>


        <div className="flex justify-end mt-8 shrink-0">
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