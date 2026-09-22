import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react'

/**
 * Composable table primitives — one consistent look for the ~50 hand-built
 * tables across the app. The global zebra-stripe + hover CSS (index.css) still
 * applies; pass data-no-stripe on <Table> to opt out.
 *
 *   <Table>
 *     <Table.Head>
 *       <Table.Row><Table.HeadCell>Name</Table.HeadCell>
 *         <Table.HeadCell align="right">Amount</Table.HeadCell></Table.Row>
 *     </Table.Head>
 *     <Table.Body>
 *       {rows.map(r => <Table.Row key={r.id}>…<Table.Cell align="right">{r.amt}</Table.Cell></Table.Row>)}
 *     </Table.Body>
 *   </Table>
 */
export function Table({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
}

function Head({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{children}</thead>
  )
}

function Body({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

function Row({ className = '', children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  )
}

function HeadCell({
  align = 'left',
  className = '',
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={`${alignCls} px-6 py-3 font-medium ${className}`} {...props}>
      {children}
    </th>
  )
}

function Cell({
  align = 'left',
  className = '',
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <td className={`${alignCls} px-6 py-4 ${className}`} {...props}>
      {children}
    </td>
  )
}

Table.Head = Head
Table.Body = Body
Table.Row = Row
Table.HeadCell = HeadCell
Table.Cell = Cell
