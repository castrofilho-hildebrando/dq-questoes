import { motion } from "framer-motion";
import { gatewayBanner } from "@/data/gatewayAssets";

const GatewayBanner = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full h-[360px] md:h-[400px] overflow-hidden relative"
    >
      <img
        src={gatewayBanner}
        alt="DQ Banner"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'center 30%' }}
      />
    </motion.div>
  );
};

export default GatewayBanner;
