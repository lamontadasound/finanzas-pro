import { useReducedMotion } from 'framer-motion';
import { AnimateDigits } from '../unlumen-ui/animate-digits';
export function FinancialDigits({ value, className }: { value: string; className?: string }) {
  const reduced = useReducedMotion();
  return <span className={className} aria-label={value}>{reduced ? value : <><span className="sr-only">{value}</span><span aria-hidden="true"><AnimateDigits value={value} gap={0} enterBlur={3} enterScale={1} enterY={20} enterDamping={25} exitDamping={25}/></span></>}</span>;
}
