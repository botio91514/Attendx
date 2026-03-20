import { FileX } from 'lucide-react';

const EmptyState = ({ message = 'No records found', icon }: { message?: string; icon?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
    {icon || <FileX className="w-16 h-16 mb-4 opacity-30" />}
    <p className="text-lg font-display">{message}</p>
  </div>
);

export default EmptyState;
