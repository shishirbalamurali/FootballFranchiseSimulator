import { motion } from 'framer-motion';

export default function Button({ children, onClick, variant = 'primary', className = '', ...props }) {
    const baseClass = 'retro-btn';
    const variantClasses = {
        primary: '',
        secondary: 'bg-theme-secondary',
        accent: 'bg-theme-accent text-ink'
    };

    return (
        <motion.button
            className={`${baseClass} ${variantClasses[variant]} ${className}`}
            onClick={onClick}
            whileTap={{ scale: 0.95 }}
            {...props}
        >
            {children}
        </motion.button>
    );
}
