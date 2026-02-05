/**
 * ACL GESTION v2 - Models Loader
 *
 * Imports all Sequelize models, defines associations,
 * and exports them alongside the sequelize instance.
 */
const { sequelize, Sequelize } = require('../config/database');

// --------------------------------------------------
// Import models
// --------------------------------------------------
const User = require('./User');
const Hotel = require('./Hotel');
const Room = require('./Room');
const UserHotel = require('./UserHotel');
const RolePermission = require('./RolePermission');
const MaintenanceTicket = require('./MaintenanceTicket');
const TicketComment = require('./TicketComment');
const RoomDispatch = require('./RoomDispatch');
const DispatchAlert = require('./DispatchAlert');
const LinenConfig = require('./LinenConfig');
const LinenTransaction = require('./LinenTransaction');
const LeaveRequest = require('./LeaveRequest');
const LeaveBalance = require('./LeaveBalance');
const TaskBoard = require('./TaskBoard');
const TaskColumn = require('./TaskColumn');
const Task = require('./Task');
const TaskComment = require('./TaskComment');
const TaskChecklist = require('./TaskChecklist');
const TaskLabel = require('./TaskLabel');
const EvaluationGrid = require('./EvaluationGrid');
const EvaluationQuestion = require('./EvaluationQuestion');
const Evaluation = require('./Evaluation');
const EvaluationAnswer = require('./EvaluationAnswer');
const DailyClosure = require('./DailyClosure');
const MonthlyClosure = require('./MonthlyClosure');
const ClosureConfig = require('./ClosureConfig');
const Notification = require('./Notification');
const Conversation = require('./Conversation');
const ConversationMessage = require('./ConversationMessage');
const AccessLog = require('./AccessLog');
const SystemConfig = require('./SystemConfig');
const Automation = require('./Automation');
const AutomationLog = require('./AutomationLog');
const CashTracking = require('./CashTracking');
const RevenueEntry = require('./RevenueEntry');
const AuditGrid = require('./AuditGrid');
const AuditQuestion = require('./AuditQuestion');
const Audit = require('./Audit');
const AuditAnswer = require('./AuditAnswer');

// --------------------------------------------------
// Associations
// --------------------------------------------------

// ===== User <-> Hotel (many-to-many through UserHotel) =====
User.belongsToMany(Hotel, {
  through: UserHotel,
  foreignKey: 'user_id',
  otherKey: 'hotel_id',
  as: 'hotels'
});
Hotel.belongsToMany(User, {
  through: UserHotel,
  foreignKey: 'hotel_id',
  otherKey: 'user_id',
  as: 'users'
});

// ===== Hotel -> Rooms =====
Hotel.hasMany(Room, { foreignKey: 'hotel_id', as: 'rooms' });
Room.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

// ===== Maintenance Tickets =====
Hotel.hasMany(MaintenanceTicket, { foreignKey: 'hotel_id', as: 'maintenanceTickets' });
MaintenanceTicket.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
MaintenanceTicket.belongsTo(User, { foreignKey: 'reported_by', as: 'reporter' });
MaintenanceTicket.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
MaintenanceTicket.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });

// ===== Ticket Comments =====
MaintenanceTicket.hasMany(TicketComment, { foreignKey: 'ticket_id', as: 'comments' });
TicketComment.belongsTo(MaintenanceTicket, { foreignKey: 'ticket_id', as: 'ticket' });
TicketComment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ===== Room Dispatch =====
Room.hasMany(RoomDispatch, { foreignKey: 'room_id', as: 'dispatches' });
RoomDispatch.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
RoomDispatch.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
RoomDispatch.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
RoomDispatch.belongsTo(User, { foreignKey: 'completed_by', as: 'completer' });
RoomDispatch.belongsTo(User, { foreignKey: 'controlled_by', as: 'controller' });

// ===== Dispatch Alerts =====
Hotel.hasMany(DispatchAlert, { foreignKey: 'hotel_id', as: 'dispatchAlerts' });
DispatchAlert.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

// ===== Linen =====
Hotel.hasMany(LinenConfig, { foreignKey: 'hotel_id', as: 'linenConfigs' });
LinenConfig.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
Hotel.hasMany(LinenTransaction, { foreignKey: 'hotel_id', as: 'linenTransactions' });
LinenTransaction.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
LinenTransaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Leave Requests =====
User.hasMany(LeaveRequest, { foreignKey: 'employee_id', as: 'leaveRequests' });
LeaveRequest.belongsTo(User, { foreignKey: 'employee_id', as: 'employee' });
LeaveRequest.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
LeaveRequest.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
Hotel.hasMany(LeaveRequest, { foreignKey: 'hotel_id', as: 'leaveRequests' });

// ===== Leave Balance =====
User.hasMany(LeaveBalance, { foreignKey: 'user_id', as: 'leaveBalances' });
LeaveBalance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ===== Task Boards =====
TaskBoard.hasMany(TaskColumn, { foreignKey: 'board_id', as: 'columns' });
TaskColumn.belongsTo(TaskBoard, { foreignKey: 'board_id', as: 'board' });
TaskBoard.hasMany(TaskLabel, { foreignKey: 'board_id', as: 'labels' });
TaskLabel.belongsTo(TaskBoard, { foreignKey: 'board_id', as: 'board' });
TaskBoard.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
TaskBoard.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

// ===== Task Columns -> Tasks =====
TaskColumn.hasMany(Task, { foreignKey: 'column_id', as: 'tasks' });
Task.belongsTo(TaskColumn, { foreignKey: 'column_id', as: 'column' });
Task.belongsTo(TaskBoard, { foreignKey: 'board_id', as: 'board' });
TaskBoard.hasMany(Task, { foreignKey: 'board_id', as: 'tasks' });

// ===== Task -> User =====
Task.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Task Comments =====
Task.hasMany(TaskComment, { foreignKey: 'task_id', as: 'comments' });
TaskComment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskComment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ===== Task Checklists =====
Task.hasMany(TaskChecklist, { foreignKey: 'task_id', as: 'checklists' });
TaskChecklist.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });

// ===== Evaluation Grids =====
EvaluationGrid.hasMany(EvaluationQuestion, { foreignKey: 'grid_id', as: 'questions' });
EvaluationQuestion.belongsTo(EvaluationGrid, { foreignKey: 'grid_id', as: 'grid' });
EvaluationGrid.hasMany(Evaluation, { foreignKey: 'grid_id', as: 'evaluations' });
EvaluationGrid.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Evaluations =====
Evaluation.belongsTo(EvaluationGrid, { foreignKey: 'grid_id', as: 'grid' });
Evaluation.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
Evaluation.belongsTo(User, { foreignKey: 'evaluated_user_id', as: 'evaluatedUser' });
Evaluation.belongsTo(User, { foreignKey: 'evaluator_id', as: 'evaluator' });
Hotel.hasMany(Evaluation, { foreignKey: 'hotel_id', as: 'evaluations' });

// ===== Evaluation Answers =====
Evaluation.hasMany(EvaluationAnswer, { foreignKey: 'evaluation_id', as: 'answers' });
EvaluationAnswer.belongsTo(Evaluation, { foreignKey: 'evaluation_id', as: 'evaluation' });
EvaluationAnswer.belongsTo(EvaluationQuestion, { foreignKey: 'question_id', as: 'question' });

// ===== Daily Closures =====
Hotel.hasMany(DailyClosure, { foreignKey: 'hotel_id', as: 'dailyClosures' });
DailyClosure.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
DailyClosure.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
DailyClosure.belongsTo(User, { foreignKey: 'validated_by', as: 'validator' });

// ===== Monthly Closures =====
Hotel.hasMany(MonthlyClosure, { foreignKey: 'hotel_id', as: 'monthlyClosures' });
MonthlyClosure.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
MonthlyClosure.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
MonthlyClosure.belongsTo(User, { foreignKey: 'validated_by', as: 'validator' });

// ===== Closure Config =====
Hotel.hasMany(ClosureConfig, { foreignKey: 'hotel_id', as: 'closureConfigs' });
ClosureConfig.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

// ===== Notifications =====
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ===== Conversations =====
Conversation.belongsTo(User, { foreignKey: 'user1_id', as: 'user1' });
Conversation.belongsTo(User, { foreignKey: 'user2_id', as: 'user2' });
Conversation.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });

// ===== Conversation Messages =====
Conversation.hasMany(ConversationMessage, { foreignKey: 'conversation_id', as: 'messages' });
ConversationMessage.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
ConversationMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// ===== Access Logs =====
AccessLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AccessLog, { foreignKey: 'user_id', as: 'accessLogs' });

// ===== Cash Tracking =====
Hotel.hasMany(CashTracking, { foreignKey: 'hotel_id', as: 'cashTrackings' });
CashTracking.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
CashTracking.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Revenue Entries =====
Hotel.hasMany(RevenueEntry, { foreignKey: 'hotel_id', as: 'revenueEntries' });
RevenueEntry.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
RevenueEntry.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Automations =====
Automation.hasMany(AutomationLog, { foreignKey: 'automation_id', as: 'logs' });
AutomationLog.belongsTo(Automation, { foreignKey: 'automation_id', as: 'automation' });
Automation.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Audit Grids =====
AuditGrid.hasMany(AuditQuestion, { foreignKey: 'grid_id', as: 'questions' });
AuditQuestion.belongsTo(AuditGrid, { foreignKey: 'grid_id', as: 'grid' });
AuditGrid.hasMany(Audit, { foreignKey: 'grid_id', as: 'audits' });
AuditGrid.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ===== Audits =====
Audit.belongsTo(AuditGrid, { foreignKey: 'grid_id', as: 'grid' });
Audit.belongsTo(Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
Audit.belongsTo(User, { foreignKey: 'auditor_id', as: 'auditor' });
Hotel.hasMany(Audit, { foreignKey: 'hotel_id', as: 'audits' });

// ===== Audit Answers =====
Audit.hasMany(AuditAnswer, { foreignKey: 'audit_id', as: 'answers' });
AuditAnswer.belongsTo(Audit, { foreignKey: 'audit_id', as: 'audit' });
AuditAnswer.belongsTo(AuditQuestion, { foreignKey: 'question_id', as: 'question' });

// --------------------------------------------------
// Export
// --------------------------------------------------
module.exports = {
  sequelize,
  Sequelize,
  User,
  Hotel,
  Room,
  UserHotel,
  RolePermission,
  MaintenanceTicket,
  TicketComment,
  RoomDispatch,
  DispatchAlert,
  LinenConfig,
  LinenTransaction,
  LeaveRequest,
  LeaveBalance,
  TaskBoard,
  TaskColumn,
  Task,
  TaskComment,
  TaskChecklist,
  TaskLabel,
  EvaluationGrid,
  EvaluationQuestion,
  Evaluation,
  EvaluationAnswer,
  DailyClosure,
  MonthlyClosure,
  ClosureConfig,
  Notification,
  Conversation,
  ConversationMessage,
  AccessLog,
  SystemConfig,
  Automation,
  AutomationLog,
  CashTracking,
  RevenueEntry,
  AuditGrid,
  AuditQuestion,
  Audit,
  AuditAnswer
};
