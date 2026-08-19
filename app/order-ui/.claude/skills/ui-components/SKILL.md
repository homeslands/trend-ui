---
name: ui-components
description: Trigger when building UI — forms, dialogs, tables, buttons, layouts, or any visual component. Enforces consistent use of the project's Radix UI + shadcn component system with Tailwind CSS.
---

# UI Components — order-ui

This project uses **Radix UI primitives** wrapped in shadcn-style components with **Tailwind CSS** and **class-variance-authority (CVA)** for variants.

## Component Library Location

```
src/components/ui/          # Atomic components — use these, don't re-create
├── button.tsx              # Button with variants: default, destructive, outline, secondary, ghost, link
├── badge.tsx
├── card.tsx                # Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription
├── dialog.tsx              # Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter
├── sheet.tsx               # Sheet (drawer/side panel)
├── form.tsx                # Form, FormField, FormItem, FormLabel, FormControl, FormMessage
├── input.tsx               # Input
├── forwarded-input.tsx     # Input with forwardRef
├── select.tsx              # Select, SelectTrigger, SelectContent, SelectItem
├── tabs.tsx                # Tabs, TabsList, TabsTrigger, TabsContent
├── data-table.tsx          # DataTable (Tanstack Table wrapper)
├── table.tsx               # Table primitives
├── dropdown-menu.tsx
├── popover.tsx
├── tooltip.tsx
├── checkbox.tsx
├── badge.tsx
└── ...
```

## Class Utilities

```ts
import { cn } from '@/lib/utils'  // NOT from '@/utils'

// Merge Tailwind classes safely
<div className={cn('base-class', condition && 'conditional-class', className)} />
```

## Button

```tsx
import { Button } from '@/components/ui/button'

// Variants: default | destructive | outline | secondary | ghost | link
// Sizes: default | sm | lg | icon

<Button variant="default">Save</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="outline" size="icon">
  <PlusIcon className="h-4 w-4" />
</Button>

// Loading state pattern
<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Save
</Button>
```

## Form (react-hook-form + Zod + shadcn Form)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CreatePrinterSchema, type TCreatePrinterSchema } from '@/schemas'

export function CreatePrinterForm() {
  const form = useForm<TCreatePrinterSchema>({
    resolver: zodResolver(CreatePrinterSchema),
    defaultValues: { name: '', ip: '', port: 9100 },
  })

  const mutation = useCreatePrinterConnector()

  const onSubmit = (values: TCreatePrinterSchema) => {
    mutation.mutate(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Printer 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create
        </Button>
      </form>
    </Form>
  )
}
```

## Dialog

```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'

// Controlled dialog (preferred for forms/mutations)
const [open, setOpen] = useState(false)

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Add Printer</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Printer</DialogTitle>
      <DialogDescription>Configure network printer connection.</DialogDescription>
    </DialogHeader>
    {/* form content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button type="submit">Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Data Table

```tsx
import { DataTable } from '@/components/ui/data-table'
import { type ColumnDef } from '@tanstack/react-table'

// Define columns OUTSIDE the component or wrap with useMemo
const columns: ColumnDef<IPrinter>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'ip',
    header: 'IP Address',
  },
  {
    id: 'actions',
    cell: ({ row }) => <PrinterActions printer={row.original} />,
  },
]

// Usage
<DataTable columns={columns} data={printers ?? []} />
```

**Important:** Define `columns` outside the component or with `useMemo` — inline column definitions cause unnecessary re-renders on every render.

## Icons

```tsx
// Use @heroicons/react (tree-shakeable — import specific icons)
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

// Or lucide-react (also tree-shakeable)
import { Loader2, Check, X } from 'lucide-react'

// Size via Tailwind
<PlusIcon className="h-4 w-4" />
<Loader2 className="h-4 w-4 animate-spin" />
```

## Layout Patterns

```tsx
// Page layout (system area)
<div className="flex flex-col gap-4 p-4">
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold">{t('title')}</h1>
    <Button onClick={handleCreate}>
      <PlusIcon className="mr-2 h-4 w-4" />
      {t('add')}
    </Button>
  </div>
  {/* content */}
</div>
```

## Notification (Printer Fail)

The app intercepts push notification codes and renders `PrinterFailDialog`:

```ts
// Codes that trigger PrinterFailDialog (in notification-provider.tsx):
// ORDER_BILL_FAILED_PRINTING
// ORDER_CHEF_ORDER_FAILED_PRINTING
// ORDER_LABEL_TICKET_FAILED_PRINTING
```

Don't create a separate dialog for printer failures — `PrinterFailDialog` in `src/components/app/` handles this globally.

## Rules

- **Always use `src/components/ui/`** components — never install raw Radix primitives directly
- **Always use `cn()` from `@/lib/utils`** for class merging — not string concatenation
- **Always use `FormField` + `FormControl`** for form inputs — not raw `<input>` with `register`
- **Never hardcode colors** — use Tailwind design tokens (`bg-primary`, `text-destructive`, etc.)
- **Never use inline styles** — use Tailwind classes only
- New UI primitives: add to `src/components/ui/`, following the shadcn pattern (Radix + CVA + cn)
