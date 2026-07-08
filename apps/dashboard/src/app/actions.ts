"use server";

import { prisma } from 'db';
import { getSession } from '../lib/auth';
import { revalidatePath } from 'next/cache';

// Helper to enforce auth and get userId
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ---------------- PROJECT ACTIONS ----------------

export async function getProjects() {
  const session = await requireAuth();
  return prisma.project.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createProject(name: string, slug: string) {
  const session = await requireAuth();

  if (!name || !slug) {
    throw new Error('Name and slug are required');
  }

  // Basic slug validation
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!cleanSlug) {
    throw new Error('Invalid project slug');
  }

  // Check unique slug
  const existing = await prisma.project.findUnique({
    where: { slug: cleanSlug },
  });
  if (existing) {
    throw new Error('Project slug is already taken');
  }

  const project = await prisma.project.create({
    data: {
      name,
      slug: cleanSlug,
      userId: session.userId,
    },
  });

  revalidatePath('/dashboard/projects');
  return project;
}

export async function deleteProject(projectId: string) {
  const session = await requireAuth();

  // Verify ownership before delete
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
  });

  if (!project) {
    throw new Error('Project not found or unauthorized');
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  revalidatePath('/dashboard/projects');
  return { success: true };
}

// ---------------- ENDPOINT ACTIONS ----------------

export async function getEndpoints(projectSlug: string) {
  const session = await requireAuth();
  return prisma.endpoint.findMany({
    where: {
      project: {
        slug: projectSlug,
        userId: session.userId,
      },
    },
    orderBy: { path: 'asc' },
  });
}

export async function getEndpointById(endpointId: string) {
  const session = await requireAuth();
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    include: { project: true },
  });

  if (!endpoint || endpoint.project.userId !== session.userId) {
    throw new Error('Endpoint not found or unauthorized');
  }

  return endpoint;
}

export async function createEndpoint(
  projectId: string,
  data: {
    path: string;
    method: string;
    headers?: string; // JSON string
    statusCode: number;
    responseBody?: string;
    delay: number;
    script?: string;
  }
) {
  const session = await requireAuth();

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
  });

  if (!project) {
    throw new Error('Project not found or unauthorized');
  }

  // Enforce delay cap of 2000ms
  const cappedDelay = Math.min(Math.max(0, data.delay || 0), 2000);

  // Validate headers JSON
  let parsedHeaders = null;
  if (data.headers) {
    try {
      parsedHeaders = JSON.parse(data.headers);
    } catch (e) {
      throw new Error('Invalid JSON format for custom headers');
    }
  }

  // Format dynamic path string: make sure it starts with /
  let cleanPath = data.path.trim();
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }

  const endpoint = await prisma.endpoint.create({
    data: {
      path: cleanPath,
      method: data.method.toUpperCase(),
      headers: parsedHeaders || {},
      statusCode: Number(data.statusCode) || 200,
      responseBody: data.responseBody || '',
      delay: cappedDelay,
      script: data.script || '',
      projectId: project.id,
    },
  });

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return endpoint;
}

export async function updateEndpoint(
  endpointId: string,
  data: {
    path: string;
    method: string;
    headers?: string;
    statusCode: number;
    responseBody?: string;
    delay: number;
    script?: string;
  }
) {
  const session = await requireAuth();

  // Verify endpoint ownership
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    include: { project: true },
  });

  if (!endpoint || endpoint.project.userId !== session.userId) {
    throw new Error('Endpoint not found or unauthorized');
  }

  // Enforce delay cap of 2000ms
  const cappedDelay = Math.min(Math.max(0, data.delay || 0), 2000);

  // Validate headers JSON
  let parsedHeaders = null;
  if (data.headers) {
    try {
      parsedHeaders = JSON.parse(data.headers);
    } catch (e) {
      throw new Error('Invalid JSON format for custom headers');
    }
  }

  let cleanPath = data.path.trim();
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }

  const updated = await prisma.endpoint.update({
    where: { id: endpointId },
    data: {
      path: cleanPath,
      method: data.method.toUpperCase(),
      headers: parsedHeaders || {},
      statusCode: Number(data.statusCode) || 200,
      responseBody: data.responseBody || '',
      delay: cappedDelay,
      script: data.script || '',
    },
  });

  revalidatePath(`/dashboard/projects/${endpoint.project.slug}/endpoints`);
  return updated;
}

export async function deleteEndpoint(endpointId: string) {
  const session = await requireAuth();

  // Verify endpoint ownership
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    include: { project: true },
  });

  if (!endpoint || endpoint.project.userId !== session.userId) {
    throw new Error('Endpoint not found or unauthorized');
  }

  await prisma.endpoint.delete({
    where: { id: endpointId },
  });

  revalidatePath(`/dashboard/projects/${endpoint.project.slug}/endpoints`);
  return { success: true };
}

// ---------------- LOG ACTIONS ----------------

export async function getLogs(projectSlug: string, limit = 50) {
  const session = await requireAuth();

  return prisma.apiLog.findMany({
    where: {
      endpoint: {
        project: {
          slug: projectSlug,
          userId: session.userId,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: {
      endpoint: true,
    },
  });
}
