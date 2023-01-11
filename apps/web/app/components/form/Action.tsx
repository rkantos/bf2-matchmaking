import { FC, PropsWithChildren } from 'react';
import { Form } from '@remix-run/react';

interface ActionProps {
  action: string;
  disabled?: boolean;
  className?: string;
}
const Action: FC<PropsWithChildren<ActionProps>> = ({ action, disabled, className, children }) => (
  <Form method="post" action={action}>
    <button type="submit" className={className} disabled={disabled}>
      {children}
    </button>
  </Form>
);

export default Action;
