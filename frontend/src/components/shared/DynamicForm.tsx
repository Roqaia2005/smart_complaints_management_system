import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { WorkflowField } from '../../types/workflow';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

interface DynamicFormProps {
  fields: WorkflowField[];
  onSubmit: (data: any) => void;
  isLoading?: boolean;
  submitLabel?: string;
  initialData?: any;
}

export function DynamicForm({ fields, onSubmit, isLoading, submitLabel = "Submit", initialData }: DynamicFormProps) {
  // Build dynamic Zod schema
  const schemaShape: Record<string, any> = {};
  fields.forEach(field => {
    let fieldSchema: any = z.any();

    if (field.type === 'text' || field.type === 'textarea' || field.type === 'select') {
      fieldSchema = z.string();
      if (field.required) fieldSchema = fieldSchema.min(1, { message: `${field.label} is required` });
    } else if (field.type === 'number') {
      fieldSchema = z.number();
    } else if (field.type === 'checkbox') {
      fieldSchema = z.boolean();
    }

    schemaShape[field.id] = fieldSchema;
  });

  const schema = z.object(schemaShape);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialData || {},
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-semibold text-foreground/80">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </label>

            {field.type === 'textarea' ? (
              <textarea
                {...register(field.id)}
                placeholder={field.placeholder}
                className={cn(
                  "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  errors[field.id] && "border-destructive focus-visible:ring-destructive"
                )}
              />
            ) : field.type === 'select' ? (
              <select
                {...register(field.id)}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  errors[field.id] && "border-destructive focus-visible:ring-destructive"
                )}
              >
                <option value="">Select an option</option>
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <Input
                {...register(field.id, { valueAsNumber: field.type === 'number' })}
                type={field.type}
                placeholder={field.placeholder}
                className={cn(errors[field.id] && "border-destructive focus-visible:ring-destructive")}
              />
            )}

            {errors[field.id] && (
              <p className="text-xs font-medium text-destructive">
                {errors[field.id]?.message as string}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full h-11" disabled={isLoading}>
        {isLoading ? "Processing..." : submitLabel}
      </Button>
    </form>
  );
}
