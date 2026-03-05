import { motion } from "framer-motion";

function BreathingRing() {
  return (
    <div className="relative flex size-16 items-center justify-center md:size-20">
      {/* Outer ring - thin line, prominent breathing glow */}
      <motion.div
        animate={{
          boxShadow: [
            "0 0 20px 6px rgba(232, 93, 4, 0.2)",
            "0 0 40px 16px rgba(232, 93, 4, 0.45)",
            "0 0 20px 6px rgba(232, 93, 4, 0.2)",
          ],
        }}
        className="absolute size-[60px] rounded-full border border-[#E85D04]/25 md:size-[70px]"
        transition={{
          duration: 2.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      {/* Middle ring - moderate thickness, subtle inner glow */}
      <motion.div
        animate={{
          boxShadow: [
            "inset 0 0 8px 2px rgba(232, 93, 4, 0.12)",
            "inset 0 0 12px 3px rgba(232, 93, 4, 0.25)",
            "inset 0 0 8px 2px rgba(232, 93, 4, 0.12)",
          ],
        }}
        className="absolute size-12 rounded-full border border-[#E85D04]/60 md:size-14 md:border-2"
        transition={{
          duration: 2.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      {/* Inner solid circle - small, subtle outer glow */}
      <motion.div
        animate={{
          boxShadow: [
            "0 0 6px 2px rgba(232, 93, 4, 0.2)",
            "0 0 10px 3px rgba(232, 93, 4, 0.35)",
            "0 0 6px 2px rgba(232, 93, 4, 0.2)",
          ],
        }}
        className="absolute size-3 rounded-full bg-[#E85D04] md:size-4"
        transition={{
          duration: 2.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

export const Greeting = () => {
  return (
    <div
      className="mx-auto mt-12 flex size-full max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center md:mt-16 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        <BreathingRing />
      </motion.div>
      <div className="flex flex-col items-center gap-0.5">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="font-bold text-xl text-[#E85D04] md:text-2xl"
          exit={{ opacity: 0, y: 10 }}
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.6 }}
        >
          Your Trusted Knowledge Layer
        </motion.div>
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="font-light italic text-base text-zinc-500 md:text-lg"
          exit={{ opacity: 0, y: 10 }}
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.7 }}
        >
          Ask anything, anytime.
        </motion.div>
      </div>
    </div>
  );
};
