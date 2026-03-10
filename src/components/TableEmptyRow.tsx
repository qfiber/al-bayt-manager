import { TableRow, TableCell } from '@/components/ui/table';

interface TableEmptyRowProps {
  colSpan: number;
  message: string;
  className?: string;
}

export const TableEmptyRow = ({ colSpan, message, className }: TableEmptyRowProps) => (
  <TableRow>
    <TableCell colSpan={colSpan} className={`text-center text-muted-foreground ${className || ''}`}>
      {message}
    </TableCell>
  </TableRow>
);
