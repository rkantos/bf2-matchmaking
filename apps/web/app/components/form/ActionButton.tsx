import { FC, PropsWithChildren } from 'react';
import { Form, FormMethod } from '@remix-run/react';

interface ActionProps {
  action: string;
  disabled?: boolean;
  className?: string;
}
const ActionButton: FC<PropsWithChildren<ActionProps>> = ({
  action,
  disabled,
  className,
  children,
}) => (
  <Form method="post" action={action} reloadDocument>
    <button type="submit" className={className} disabled={disabled}>
      {children}
    </button>
  </Form>
);

export default ActionButton;
