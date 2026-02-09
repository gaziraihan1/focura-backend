import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { TaskService } from '../services/task.service.js';

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { type, workspaceId, projectId, status, priority, labelIds, assigneeId } = req.query;
    
    console.log('📋 GET /api/tasks called');
    console.log('  User:', req.user?.email);
    console.log('  Query params:', req.query);

    const labelIdsArray = labelIds 
      ? (typeof labelIds === 'string' ? labelIds.split(',').filter(Boolean) : [])
      : undefined;

    const tasks = await TaskService.getTasks({
      userId: req.user!.id,
      type: type as string | undefined,
      workspaceId: workspaceId as string | undefined,
      projectId: projectId as string | undefined,
      status: status as string | undefined,
      priority: priority as string | undefined,
      labelIds: labelIdsArray,
      assigneeId: assigneeId as string | undefined,
    });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
    });
  }
};

export const getTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, type } = req.query;
    
    console.log('📊 GET /api/tasks/stats called');
    console.log('  User:', req.user?.email);
    console.log('  WorkspaceId:', workspaceId);
    console.log('  Type:', type);

    const stats = await TaskService.getTaskStats({
      userId: req.user!.id,
      workspaceId: workspaceId as string | undefined,
      type: type as string | undefined,
    });

    console.log('📊 Stats computed:', stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task statistics',
    });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      projectId,
      status,
      priority,
      dueDate,
      startDate,
      estimatedHours,
      assigneeIds,
      labelIds,
      parentId,
      focusRequired,
      focusLevel,
      energyType,
      distractionCost,
      intent,
    } = req.body;

    const task = await TaskService.createTask({
      title,
      description,
      projectId,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      estimatedHours,
      assigneeIds,
      labelIds,
      parentId,
      focusRequired,
      focusLevel,
      energyType,
      distractionCost,
      intent,
      createdById: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    console.error("Create task error:", error);
    
    if (error instanceof Error) {
      const message = error.message;
      
      if (message.includes('required') || message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: message,
        });
      }
      
      if (message.includes('access') || message.includes('permission')) {
        return res.status(403).json({
          success: false,
          message: message,
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await TaskService.getTaskById({
      taskId: id,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Get task error:', error);
    
    if (error instanceof Error && error.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
    });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      startDate,
      estimatedHours,
      assigneeIds,
      labelIds,
      focusRequired,
      focusLevel,
      energyType,
      distractionCost,
      intent,
    } = req.body;

    const task = await TaskService.updateTask({
      taskId: id,
      userId: req.user!.id,
      data: {
        title,
        description,
        status,
        priority,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        estimatedHours,
        assigneeIds,
        labelIds,
        focusRequired,
        focusLevel,
        energyType,
        distractionCost,
        intent,
      },
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: task,
    });
  } catch (error) {
    console.error('Update task error:', error);
    
    if (error instanceof Error) {
      const message = error.message;
      
      if (message === 'Task not found') {
        return res.status(404).json({
          success: false,
          message: message,
        });
      }
      
      if (message.includes('permission') || message.includes('access')) {
        return res.status(403).json({
          success: false,
          message: message,
        });
      }
      
      if (message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: message,
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
    });
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const task = await TaskService.updateTaskStatus({
      taskId: id,
      userId: req.user!.id,
      status,
    });

    res.json({ 
      success: true, 
      data: task 
    });
  } catch (error: any) {
    console.error('Update task status error:', error);
    
    if (error instanceof Error) {
      const message = error.message;
      
      if (message === 'Task not found') {
        return res.status(404).json({
          success: false,
          message: message,
        });
      }
      
      if (message.includes('permission') || message.includes('access')) {
        return res.status(403).json({
          success: false,
          message: message,
        });
      }
      
      if (message.includes('required')) {
        return res.status(400).json({
          success: false,
          message: message,
        });
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to update task status'
    });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await TaskService.deleteTask({
      taskId: id,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    
    if (error instanceof Error && error.message.includes('permission')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
    });
  }
};