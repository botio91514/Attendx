export const getStatusColor = (status: string) => {
  if (!status) return 'status-badge bg-secondary text-secondary-foreground';
  
  const s = status.toLowerCase();
  switch (s) {
    case 'present': return 'status-present';
    case 'absent': return 'status-absent';
    case 'late': return 'status-late';
    case 'leave': return 'status-leave';
    case 'break': return 'status-break';
    case 'approved': return 'status-present';
    case 'rejected': return 'status-absent';
    case 'pending': return 'status-late';
    default: return 'status-badge bg-secondary text-secondary-foreground';
  }
};

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};
