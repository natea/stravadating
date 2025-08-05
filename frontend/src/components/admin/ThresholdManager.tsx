import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';

interface FitnessThreshold {
  id: string;
  name: string;
  description: string;
  metricType: 'distance' | 'activities' | 'pace' | 'duration';
  threshold: number;
  comparisonOperator: 'gte' | 'lte' | 'eq';
  timeWindowDays: number;
  isActive: boolean;
  priority: number;
}

const ThresholdManager: React.FC = () => {
  const [thresholds, setThresholds] = useState<FitnessThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingThreshold, setEditingThreshold] = useState<FitnessThreshold | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState<Partial<FitnessThreshold>>({
    name: '',
    description: '',
    metricType: 'distance',
    threshold: 0,
    comparisonOperator: 'gte',
    timeWindowDays: 90,
    isActive: true,
    priority: 1,
  });

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getThresholds();
      setThresholds(data);
    } catch (error) {
      console.error('Failed to load thresholds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaveMessage(null);

      if (editingThreshold) {
        await adminService.updateThreshold(editingThreshold.id, formData);
        setSaveMessage({
          type: 'success',
          text: 'Threshold updated successfully!',
        });
      } else {
        await adminService.createThreshold(formData as FitnessThreshold);
        setSaveMessage({
          type: 'success',
          text: 'Threshold created successfully!',
        });
      }

      await loadThresholds();
      setEditingThreshold(null);
      setIsAddingNew(false);
      setFormData({
        name: '',
        description: '',
        metricType: 'distance',
        threshold: 0,
        comparisonOperator: 'gte',
        timeWindowDays: 90,
        isActive: true,
        priority: 1,
      });

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save threshold' });
      console.error('Failed to save threshold:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this threshold?')) {
      try {
        await adminService.deleteThreshold(id);
        await loadThresholds();
        setSaveMessage({
          type: 'success',
          text: 'Threshold deleted successfully!',
        });
        setTimeout(() => setSaveMessage(null), 3000);
      } catch (error) {
        setSaveMessage({ type: 'error', text: 'Failed to delete threshold' });
        console.error('Failed to delete threshold:', error);
      }
    }
  };

  const handleToggleActive = async (threshold: FitnessThreshold) => {
    try {
      await adminService.updateThreshold(threshold.id, {
        isActive: !threshold.isActive,
      });
      await loadThresholds();
    } catch (error) {
      console.error('Failed to toggle threshold:', error);
    }
  };

  const handleEdit = (threshold: FitnessThreshold) => {
    setEditingThreshold(threshold);
    setFormData(threshold);
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingThreshold(null);
    setFormData({
      name: '',
      description: '',
      metricType: 'distance',
      threshold: 0,
      comparisonOperator: 'gte',
      timeWindowDays: 90,
      isActive: true,
      priority: 1,
    });
  };

  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case 'gte':
        return '≥';
      case 'lte':
        return '≤';
      case 'eq':
        return '=';
      default:
        return operator;
    }
  };

  const getMetricUnit = (metricType: string) => {
    switch (metricType) {
      case 'distance':
        return 'km';
      case 'activities':
        return 'activities';
      case 'pace':
        return 'min/km';
      case 'duration':
        return 'hours';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Fitness Thresholds</h2>
          <button
            onClick={handleAddNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add New Threshold
          </button>
        </div>

        {saveMessage && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              saveMessage.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        {/* Threshold Form */}
        {(isAddingNew || editingThreshold) && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-semibold mb-4">
              {editingThreshold ? 'Edit Threshold' : 'Add New Threshold'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metric Type</label>
                <select
                  value={formData.metricType}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      metricType: e.target.value as 'distance' | 'activities' | 'pace' | 'duration',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="distance">Distance</option>
                  <option value="activities">Activities</option>
                  <option value="pace">Pace</option>
                  <option value="duration">Duration</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                <select
                  value={formData.comparisonOperator}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      comparisonOperator: e.target.value as 'gte' | 'lte' | 'eq',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gte">Greater than or equal (≥)</option>
                  <option value="lte">Less than or equal (≤)</option>
                  <option value="eq">Equal (=)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Threshold Value
                </label>
                <input
                  type="number"
                  value={formData.threshold}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      threshold: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Window (days)
                </label>
                <input
                  type="number"
                  value={formData.timeWindowDays}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      timeWindowDays: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setEditingThreshold(null);
                  setIsAddingNew(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Threshold
              </button>
            </div>
          </div>
        )}

        {/* Thresholds List */}
        <div className="space-y-2">
          {thresholds.map(threshold => (
            <div
              key={threshold.id}
              className={`p-4 border rounded-lg ${
                threshold.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{threshold.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        threshold.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {threshold.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                      Priority: {threshold.priority}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{threshold.description}</p>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium">
                      {threshold.metricType} {getOperatorLabel(threshold.comparisonOperator)}{' '}
                      {threshold.threshold} {getMetricUnit(threshold.metricType)}
                    </span>
                    <span className="text-gray-500">over {threshold.timeWindowDays} days</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(threshold)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {threshold.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEdit(threshold)}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(threshold.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {thresholds.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No thresholds configured. Add your first threshold to start filtering users.
          </div>
        )}
      </div>
    </div>
  );
};

export default ThresholdManager;
