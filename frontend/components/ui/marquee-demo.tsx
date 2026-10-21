"use client";

import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Marquee } from "./marquee";
import huy from "../../public/image/huy.jpg";
import seyha from "../../public/image/seyha.jpg";
import danich from "../../public/image/sodanich.jpg";
import pisoth from "../../public/image/pisoth.jpg";

const reviews = [
  {
    name: "Net Pisoth",
    username: "pisoth887@gmail.com",
    body: "A Full-Stack Developer and Computer Science Student | Building innovative web applications with React, Next.js, Python and Java | Always learning, building, and growing.",
    img: pisoth,
  },
  {
    name: "Pho Seyha",
    username: "@psh",
    body: "I don't know what to say. I'm speechless. This is amazing.",
    img: seyha,
  },
  {
    name: "Chheang Huy",
    username: "@huy",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: huy,
  },
  {
    name: "Mov Sodanich",
    username: "@sodanich",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: danich,
  },
];

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);

const ReviewCard = ({
  img,
  name,
  username,
  body,
}: {
  img: StaticImageData;
  name: string;
  username: string;
  body: string;
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`View ${name}'s review`}
          className={cn(
            "relative h-full w-64 cursor-pointer overflow-hidden rounded-xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            // light styles
            "border-gray-950/10 bg-gray-950/1 hover:bg-gray-950/5",
            // dark styles
            "dark:border-gray-50/10 dark:bg-gray-50/10 dark:hover:bg-gray-50/15",
          )}
        >
          <span className="flex flex-row items-center gap-2">
            <Image
              className="size-8 shrink-0 rounded-full object-cover"
              width={32}
              height={32}
              alt=""
              src={img}
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium dark:text-white">
                {name}
              </span>
              <span className="text-xs font-medium dark:text-white/40">
                {username}
              </span>
            </span>
          </span>
          <span className="mt-2 line-clamp-2 text-sm">{body}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Image
            src={img}
            alt={`Portrait of ${name}`}
            sizes="(max-width: 640px) calc(100vw - 5rem), 280px"
            className="aspect-square w-full rounded-xl object-cover"
          />
          <div className="min-w-0 sm:py-6 sm:pr-4">
            <DialogTitle asChild>
              <h3 className="text-2xl font-semibold">{name}</h3>
            </DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">{username}</p>
            <DialogDescription asChild>
              <span className="mt-4 block text-base leading-relaxed">
                {body}
              </span>
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export function MarqueeDemo() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
      <Marquee pauseOnHover className="[--duration:20s]">
        {firstRow.map((review) => (
          <ReviewCard key={review.username} {...review} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="[--duration:20s]">
        {secondRow.map((review) => (
          <ReviewCard key={review.username} {...review} />
        ))}
      </Marquee>

      <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-linear-to-r"></div>
      <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-linear-to-l"></div>
    </div>
  );
}
