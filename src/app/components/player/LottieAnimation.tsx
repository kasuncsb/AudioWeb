import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import animationData from '../../../../public/lottie/anim-ul.json';

interface LottieAnimationProps {
  show: boolean;
}

export const LottieAnimation: React.FC<LottieAnimationProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="fixed top-12 md:top-16 left-1/2 transform -translate-x-1/2 pointer-events-none z-0">
      <div className="w-[20vw] h-[20vw] min-w-50 min-h-50 max-w-70 max-h-70">
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
          style={{
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    </div>
  );
};
