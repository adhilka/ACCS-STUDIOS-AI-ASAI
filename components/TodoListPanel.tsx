import React from 'react';
import { AiChatMessage } from '../types';
import { ChecklistIcon } from './icons';

interface TodoListPanelProps {
  messages: AiChatMessage[];
  onUpdateTaskStatus: (messageId: string, isComplete: boolean) => void;
  onJumpToMessage: (messageId: string) => void;
}

const TodoListPanel: React.FC<TodoListPanelProps> = ({ messages, onUpdateTaskStatus, onJumpToMessage }) => {
  const tasks = messages.filter(msg => msg.type === 'task');
  const openTasks = tasks.filter(task => !task.isComplete).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  const completedTasks = tasks.filter(task => task.isComplete).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

  const TaskItem: React.FC<{ task: AiChatMessage }> = ({ task }) => (
    <div className="flex items-start gap-3 p-2 rounded-md hover:bg-base-300/50 group">
      <input
        type="checkbox"
        checked={!!task.isComplete}
        onChange={(e) => onUpdateTaskStatus(task.id, e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
      />
      <div className="flex-grow">
        <p className={`text-sm ${task.isComplete ? 'line-through text-neutral' : 'text-base-content'}`}>
          {task.taskText}
        </p>
        <p className="text-xs text-neutral/80 mt-1">
          Created by {task.senderInfo?.displayName || 'user'} on {task.timestamp?.toDate().toLocaleDateString()}
        </p>
      </div>
      <button onClick={() => onJumpToMessage(task.id)} className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
        Jump to
      </button>
    </div>
  );

  return (
    <div className="p-2 text-sm text-neutral h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 mb-2 border-b border-base-300">
        <ChecklistIcon className="w-5 h-5 text-accent" />
        <h3 className="text-sm font-semibold tracking-wider uppercase text-base-content">
          Project To-Do List
        </h3>
      </div>
      <div className="flex-grow overflow-y-auto pr-1">
        <h4 className="font-semibold text-base-content my-2 px-2">Open Tasks ({openTasks.length})</h4>
        {openTasks.length > 0 ? (
          <div className="space-y-1">{openTasks.map(task => <TaskItem key={task.id} task={task} />)}</div>
        ) : (
          <p className="px-2 text-xs">No open tasks. Create one in chat with `/task ...`</p>
        )}
        
        <h4 className="font-semibold text-base-content my-2 mt-6 px-2">Completed Tasks ({completedTasks.length})</h4>
        {completedTasks.length > 0 ? (
          <div className="space-y-1">{completedTasks.map(task => <TaskItem key={task.id} task={task} />)}</div>
        ) : (
          <p className="px-2 text-xs">No tasks have been completed yet.</p>
        )}
      </div>
    </div>
  );
};

export default TodoListPanel;
