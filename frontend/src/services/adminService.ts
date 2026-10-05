import axios from 'axios';
import { SystemUser, Organization, CreateUserDTO, UpdateUserDTO } from '../types/admin';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const adminApi = axios.create({
  baseURL: `${API_URL}/admin`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const adminService = {
  // --- USERS ---
  getUsers: async (): Promise<SystemUser[]> => {
    const res = await adminApi.get<SystemUser[]>('/users');
    return res.data;
  },

  createUser: async (user: CreateUserDTO): Promise<SystemUser> => {
    const res = await adminApi.post<SystemUser>('/users', user);
    return res.data;
  },

  updateUser: async (id: string, user: UpdateUserDTO): Promise<SystemUser> => {
    const res = await adminApi.put<SystemUser>(`/users/${id}`, user);
    return res.data;
  },

  deleteUser: async (id: string): Promise<{ success: boolean }> => {
    const res = await adminApi.delete<{ success: boolean }>(`/users/${id}`);
    return res.data;
  },

  // --- ORGANIZATIONS ---
  getOrganizations: async (): Promise<Organization[]> => {
    const res = await adminApi.get<Organization[]>('/organizations');
    return res.data;
  },

  createOrganization: async (org: { name: string; plan?: string }): Promise<Organization> => {
    const res = await adminApi.post<Organization>('/organizations', org);
    return res.data;
  },

  updateOrganization: async (id: string, org: { name?: string; plan?: string }): Promise<Organization> => {
    const res = await adminApi.put<Organization>(`/organizations/${id}`, org);
    return res.data;
  },

  deleteOrganization: async (id: string): Promise<{ success: boolean }> => {
    const res = await adminApi.delete<{ success: boolean }>(`/organizations/${id}`);
    return res.data;
  },
};
