import ActionFormModal from '@/components/commons/ActionFormModal';
import ActionButton, { ActionButtonProps } from '@/components/ActionButton';

interface Props extends ActionButtonProps {
  label: string;
  guard: boolean;
  guardLabel: string;
  formAction: () => Promise<{ data: unknown; error: { message: string } | null }>;
  successMessage: string;
  errorMessage: string;
  disabled?: boolean;
}

export default function GuardedActionButton({
  label,
  guard,
  guardLabel,
  ...actionProps
}: Props) {
  if (guard) {
    return (
      <ActionFormModal
        title={label}
        openBtnLabel={label}
        openBtnSize={actionProps.size || 'btn-md'}
        openBtnKind={actionProps.kind}
        {...actionProps}
      >
        {guardLabel}
      </ActionFormModal>
    );
  }
  return <ActionButton {...actionProps}>{label}</ActionButton>;
}
