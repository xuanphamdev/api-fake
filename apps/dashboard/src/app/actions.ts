"use server";

import { prisma } from 'db';
import { getSession } from '../lib/auth';
import { revalidatePath } from 'next/cache';
import { encrypt } from '../lib/crypto';

// Helper to enforce auth and get userId
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ---------------- RBAC & SECURITY HELPERS ----------------

async function verifyProjectAccess(projectId: string, userId: string, requiredRole: 'READ' | 'WRITE') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { collaborators: true }
  });

  if (!project) throw new Error('Project not found');

  if (project.userId === userId) {
    return project; // Owner has all permissions
  }

  const collaborator = project.collaborators.find(
    (c) => c.email.toLowerCase() === user.email.toLowerCase()
  );
  if (!collaborator) {
    throw new Error('Unauthorized');
  }

  if (requiredRole === 'WRITE' && collaborator.role !== 'WRITE') {
    throw new Error('Unauthorized: Write permissions required');
  }

  return project;
}

async function verifyEndpointAccess(endpointId: string, userId: string, requiredRole: 'READ' | 'WRITE') {
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    include: {
      project: {
        include: { collaborators: true }
      }
    }
  });

  if (!endpoint) throw new Error('Endpoint not found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  if (endpoint.project.userId === userId) {
    return endpoint; // Owner has all permissions
  }

  const collaborator = endpoint.project.collaborators.find(
    (c) => c.email.toLowerCase() === user.email.toLowerCase()
  );
  if (!collaborator) {
    throw new Error('Unauthorized');
  }

  if (requiredRole === 'WRITE' && collaborator.role !== 'WRITE') {
    throw new Error('Unauthorized: Write permissions required');
  }

  return endpoint;
}

// ---------------- PROJECT ACTIONS ----------------

export async function getProjects() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return [];

  return prisma.project.findMany({
    where: {
      OR: [
        { userId: session.userId },
        { collaborators: { some: { email: user.email.toLowerCase() } } }
      ]
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createProject(name: string, slug: string) {
  const session = await requireAuth();

  if (!name || !slug) {
    throw new Error('Name and slug are required');
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!cleanSlug) {
    throw new Error('Invalid project slug');
  }

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

  // Only project owners can delete the project
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
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return [];

  return prisma.endpoint.findMany({
    where: {
      project: {
        slug: projectSlug,
        OR: [
          { userId: session.userId },
          { collaborators: { some: { email: user.email.toLowerCase() } } }
        ]
      },
    },
    orderBy: { path: 'asc' },
  });
}

export async function getEndpointById(endpointId: string) {
  const session = await requireAuth();
  const endpoint = await verifyEndpointAccess(endpointId, session.userId, 'READ');
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
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  const cappedDelay = Math.min(Math.max(0, data.delay || 0), 2000);

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
  const endpoint = await verifyEndpointAccess(endpointId, session.userId, 'WRITE');

  const cappedDelay = Math.min(Math.max(0, data.delay || 0), 2000);

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
  const endpoint = await verifyEndpointAccess(endpointId, session.userId, 'WRITE');

  await prisma.endpoint.delete({
    where: { id: endpointId },
  });

  revalidatePath(`/dashboard/projects/${endpoint.project.slug}/endpoints`);
  return { success: true };
}

// ---------------- LOG ACTIONS ----------------

export async function getLogs(projectSlug: string, limit = 50) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return [];

  return prisma.apiLog.findMany({
    where: {
      endpoint: {
        project: {
          slug: projectSlug,
          OR: [
            { userId: session.userId },
            { collaborators: { some: { email: user.email.toLowerCase() } } }
          ]
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

// ---------------- CORS ACTIONS ----------------

export async function updateProjectCors(
  projectId: string,
  data: {
    corsOrigins: string | null;
    corsHeaders: string | null;
    corsMethods: string | null;
    corsCredentials: boolean;
  }
) {
  const session = await requireAuth();
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      corsOrigins: data.corsOrigins,
      corsHeaders: data.corsHeaders,
      corsMethods: data.corsMethods,
      corsCredentials: data.corsCredentials,
    },
  });

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return updated;
}

// ---------------- SECRETS ACTIONS ----------------

export async function getProjectSecrets(projectSlug: string) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return [];

  return prisma.projectSecret.findMany({
    where: {
      project: {
        slug: projectSlug,
        OR: [
          { userId: session.userId },
          { collaborators: { some: { email: user.email.toLowerCase() } } }
        ]
      },
    },
    orderBy: { key: 'asc' },
  });
}

export async function createProjectSecret(
  projectId: string,
  key: string,
  value: string
) {
  const session = await requireAuth();
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  if (!key || !value) {
    throw new Error('Key and value are required');
  }

  const encryptedValue = encrypt(value);

  const secret = await prisma.projectSecret.create({
    data: {
      key: key.trim().toUpperCase(),
      encryptedValue,
      projectId,
    },
  });

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return secret;
}

export async function deleteProjectSecret(secretId: string) {
  const session = await requireAuth();

  const secret = await prisma.projectSecret.findUnique({
    where: { id: secretId },
    include: { project: true }
  });
  if (!secret) throw new Error('Secret not found');

  await verifyProjectAccess(secret.projectId, session.userId, 'WRITE');

  await prisma.projectSecret.delete({
    where: { id: secretId },
  });

  revalidatePath(`/dashboard/projects/${secret.project.slug}/endpoints`);
  return { success: true };
}

// ---------------- COLLABORATORS ACTIONS ----------------

export async function getProjectCollaborators(projectSlug: string) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return [];

  return prisma.projectCollaborator.findMany({
    where: {
      project: {
        slug: projectSlug,
        OR: [
          { userId: session.userId },
          { collaborators: { some: { email: user.email.toLowerCase() } } }
        ]
      },
    },
    orderBy: { email: 'asc' },
  });
}

export async function createProjectCollaborator(
  projectId: string,
  email: string,
  role: string
) {
  const session = await requireAuth();
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  const collaborator = await prisma.projectCollaborator.create({
    data: {
      email: email.trim().toLowerCase(),
      role,
      projectId,
    },
  });

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return collaborator;
}

export async function deleteProjectCollaborator(collaboratorId: string) {
  const session = await requireAuth();

  const collaborator = await prisma.projectCollaborator.findUnique({
    where: { id: collaboratorId },
    include: { project: true }
  });
  if (!collaborator) throw new Error('Collaborator not found');

  await verifyProjectAccess(collaborator.projectId, session.userId, 'WRITE');

  await prisma.projectCollaborator.delete({
    where: { id: collaboratorId },
  });

  revalidatePath(`/dashboard/projects/${collaborator.project.slug}/endpoints`);
  return { success: true };
}

// ---------------- API KEYS ACTIONS ----------------

export async function getApiKeys(projectSlug: string) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return [];

  return prisma.apiKey.findMany({
    where: {
      project: {
        slug: projectSlug,
        OR: [
          { userId: session.userId },
          { collaborators: { some: { email: user.email.toLowerCase() } } }
        ]
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApiKey(
  projectId: string,
  name: string
) {
  const session = await requireAuth();
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  const crypto = require('crypto');
  const token = 'agy_live_' + crypto.randomBytes(24).toString('hex');

  const apiKey = await prisma.apiKey.create({
    data: {
      key: token,
      name: name.trim(),
      projectId,
    },
  });

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return apiKey;
}

export async function deleteApiKey(apiKeyId: string) {
  const session = await requireAuth();

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    include: { project: true }
  });
  if (!apiKey) throw new Error('API Key not found');

  await verifyProjectAccess(apiKey.projectId, session.userId, 'WRITE');

  await prisma.apiKey.delete({
    where: { id: apiKeyId },
  });

  revalidatePath(`/dashboard/projects/${apiKey.project.slug}/endpoints`);
  return { success: true };
}

export async function toggleApiKeyAuth(projectId: string, enforce: boolean) {
  const session = await requireAuth();
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      enforceApiKey: enforce,
    },
  });

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return updated;
}

// ---------------- OPENAPI SPEC MIGRATION & WEBHOOKS ----------------

export async function importOpenApiSpec(projectId: string, specJsonText: string) {
  const session = await requireAuth();
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  let spec: any;
  try {
    spec = JSON.parse(specJsonText);
  } catch (e) {
    throw new Error('Invalid JSON format for OpenAPI spec');
  }

  const paths = spec.paths || {};
  let createdCount = 0;

  for (const [pathPattern, pathObj] of Object.entries(paths)) {
    for (const [method, methodObj] of Object.entries(pathObj as any)) {
      const formattedMethod = method.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(formattedMethod)) {
        continue;
      }

      const cleanPath = pathPattern.replace(/\{([^}]+)\}/g, ':$1');

      let statusCode = 200;
      let responseBody = '';
      const responses = (methodObj as any).responses || {};
      const successResponse = responses['200'] || responses['201'] || Object.values(responses)[0];

      if (successResponse) {
        const content = (successResponse as any).content || {};
        const jsonContent = content['application/json'];
        if (jsonContent && jsonContent.example) {
          responseBody = JSON.stringify(jsonContent.example, null, 2);
        } else if (jsonContent && jsonContent.schema) {
          responseBody = JSON.stringify({ message: "Auto-generated stub from schema" }, null, 2);
        }
      }

      try {
        await prisma.endpoint.upsert({
          where: {
            projectId_path_method: {
              projectId,
              path: cleanPath,
              method: formattedMethod,
            }
          },
          update: {
            statusCode,
            responseBody,
          },
          create: {
            projectId,
            path: cleanPath,
            method: formattedMethod,
            statusCode,
            responseBody,
            headers: { 'Content-Type': 'application/json' },
          }
        });
        createdCount++;
      } catch (e) {
        console.error(`Error importing endpoint ${formattedMethod} ${cleanPath}:`, e);
      }
    }
  }

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return { success: true, count: createdCount };
}

export async function updateProjectWebhook(projectId: string, webhookUrl: string | null) {
  const session = await requireAuth();
  const project = await verifyProjectAccess(projectId, session.userId, 'WRITE');

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      webhookUrl: webhookUrl ? webhookUrl.trim() : null,
    },
  });

  revalidatePath(`/dashboard/projects/${project.slug}/endpoints`);
  return updated;
}
