import { Server, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token (you'll need to implement this)
      // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      // socket.userId = decoded.userId;
      // socket.userRole = decoded.role;

      // For now, allow all connections
      socket.userId = 'temp-user-id';
      socket.userRole = 'CUSTOMER';

      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    // Join user to their role-specific room
    if (socket.userRole) {
      socket.join(socket.userRole.toLowerCase());
    }

    // Join user to their personal room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Handle booking updates
    socket.on('join-booking-room', (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
      console.log(`User ${socket.userId} joined booking room: ${bookingId}`);
    });

    // Handle order updates
    socket.on('join-order-room', (orderId: string) => {
      socket.join(`order:${orderId}`);
      console.log(`User ${socket.userId} joined order room: ${orderId}`);
    });

    // Handle vendor updates
    socket.on('join-vendor-room', (vendorId: string) => {
      socket.join(`vendor:${vendorId}`);
      console.log(`User ${socket.userId} joined vendor room: ${vendorId}`);
    });

    // Handle chat messages
    socket.on('send-message', async (data: {
      recipientId: string;
      message: string;
      type: 'text' | 'image' | 'file';
    }) => {
      try {
        // Save message to database (you'll need to implement this)
        // const savedMessage = await prisma.message.create({
        //   data: {
        //     senderId: socket.userId!,
        //     recipientId: data.recipientId,
        //     content: data.message,
        //     type: data.type
        //   }
        // });

        // Emit to recipient
        io.to(`user:${data.recipientId}`).emit('new-message', {
          senderId: socket.userId,
          message: data.message,
          type: data.type,
          timestamp: new Date()
        });

        // Emit back to sender for confirmation
        socket.emit('message-sent', {
          recipientId: data.recipientId,
          message: data.message,
          type: data.type,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message-error', {
          error: 'Failed to send message'
        });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (recipientId: string) => {
      socket.to(`user:${recipientId}`).emit('user-typing', {
        userId: socket.userId,
        isTyping: true
      });
    });

    socket.on('typing-stop', (recipientId: string) => {
      socket.to(`user:${recipientId}`).emit('user-typing', {
        userId: socket.userId,
        isTyping: false
      });
    });

    // Handle online status
    socket.on('set-online-status', (status: 'online' | 'offline' | 'away') => {
      if (socket.userId) {
        // Update user status in database
        // await prisma.user.update({
        //   where: { id: socket.userId },
        //   data: { onlineStatus: status, lastSeen: new Date() }
        // });

        // Broadcast to relevant users
        socket.broadcast.emit('user-status-change', {
          userId: socket.userId,
          status,
          timestamp: new Date()
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.userId}`);

      if (socket.userId) {
        // Update user status to offline
        // await prisma.user.update({
        //   where: { id: socket.userId },
        //   data: { onlineStatus: 'offline', lastSeen: new Date() }
        // });

        // Broadcast offline status
        socket.broadcast.emit('user-status-change', {
          userId: socket.userId,
          status: 'offline',
          timestamp: new Date()
        });
      }
    });
  });
};

// Utility functions for emitting events from other parts of the application
export const emitBookingUpdate = (io: Server, bookingId: string, update: any) => {
  io.to(`booking:${bookingId}`).emit('booking-updated', {
    bookingId,
    update,
    timestamp: new Date()
  });
};

export const emitOrderUpdate = (io: Server, orderId: string, update: any) => {
  io.to(`order:${orderId}`).emit('order-updated', {
    orderId,
    update,
    timestamp: new Date()
  });
};

export const emitVendorUpdate = (io: Server, vendorId: string, update: any) => {
  io.to(`vendor:${vendorId}`).emit('vendor-updated', {
    vendorId,
    update,
    timestamp: new Date()
  });
};

export const emitNotification = (io: Server, userId: string, notification: any) => {
  io.to(`user:${userId}`).emit('new-notification', {
    ...notification,
    timestamp: new Date()
  });
};

export const emitAdminNotification = (io: Server, notification: any) => {
  io.to('admin').emit('new-admin-notification', {
    ...notification,
    timestamp: new Date()
  });
};

export const emitVendorNotification = (io: Server, vendorId: string, notification: any) => {
  io.to(`vendor:${vendorId}`).emit('new-vendor-notification', {
    ...notification,
    timestamp: new Date()
  });
};

// Broadcast functions for system-wide events
export const broadcastSystemMessage = (io: Server, message: string, type: 'info' | 'warning' | 'error' = 'info') => {
  io.emit('system-message', {
    message,
    type,
    timestamp: new Date()
  });
};

export const broadcastMaintenanceNotice = (io: Server, notice: string, scheduledTime?: Date) => {
  io.emit('maintenance-notice', {
    notice,
    scheduledTime,
    timestamp: new Date()
  });
};

// Room management utilities
export const getConnectedUsers = (io: Server) => {
  const connectedUsers: string[] = [];

  io.sockets.sockets.forEach((socket: any) => {
    if (socket.userId) {
      connectedUsers.push(socket.userId);
    }
  });

  return [...new Set(connectedUsers)];
};

export const getUsersInRoom = (io: Server, room: string) => {
  const roomSockets = io.sockets.adapter.rooms.get(room);
  if (!roomSockets) return [];

  const users: string[] = [];
  roomSockets.forEach((socketId: string) => {
    const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
    if (socket?.userId) {
      users.push(socket.userId);
    }
  });

  return [...new Set(users)];
};

export const disconnectUser = (io: Server, userId: string) => {
  io.sockets.sockets.forEach((socket: any) => {
    if (socket.userId === userId) {
      socket.disconnect(true);
    }
  });
};
