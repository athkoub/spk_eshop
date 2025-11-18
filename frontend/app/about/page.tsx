import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us - Members Only Grocery',
  description: 'Learn about our mission to provide premium grocery shopping experience for our exclusive members.',
};

const values = [
  {
    name: 'Quality First',
    description: 'We source only the finest products from trusted suppliers and premium brands.',
  },
  {
    name: 'Member-Centric',
    description: 'Every decision we make is with our members\' satisfaction and experience in mind.',
  },
  {
    name: 'Sustainability',
    description: 'Committed to environmentally responsible sourcing and packaging practices.',
  },
  {
    name: 'Innovation',
    description: 'Continuously improving our technology and service to enhance your shopping experience.',
  },
];

const team = [
  {
    name: 'Sarah Chen',
    role: 'CEO & Founder',
    bio: 'Former retail executive with 15 years of experience in premium grocery markets.',
    image: '/images/team/sarah.jpg',
  },
  {
    name: 'Michael Rodriguez',
    role: 'Head of Operations',
    bio: 'Supply chain expert ensuring fresh, quality products reach our members quickly.',
    image: '/images/team/michael.jpg',
  },
  {
    name: 'Emily Watson',
    role: 'Member Experience Director',
    bio: 'Dedicated to creating exceptional experiences for our valued members.',
    image: '/images/team/emily.jpg',
  },
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero section */}
      <div className="relative isolate overflow-hidden bg-gradient-to-b from-primary-100/20 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              About Members Only Grocery
            </h1>
            <p className="mt-6 text-xl leading-8 text-gray-700">
              We're revolutionizing grocery shopping through exclusive membership, premium products, 
              and personalized service that puts quality above everything else.
            </p>
          </div>
        </div>
      </div>

      {/* Content section */}
      <div className="mx-auto -mt-12 max-w-7xl px-6 sm:mt-0 lg:px-8 xl:-mt-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <div className="grid max-w-xl grid-cols-1 gap-8 text-base leading-7 text-gray-700 lg:max-w-none lg:grid-cols-2">
            <div>
              <p>
                Founded in 2020, Members Only Grocery began with a simple vision: to create a premium grocery 
                shopping experience that puts quality, service, and member satisfaction above all else. We believe 
                that grocery shopping shouldn't be a chore, but rather an experience that enhances your lifestyle.
              </p>
              <p className="mt-8">
                Our carefully curated selection of over 8,000 premium products comes from trusted suppliers, 
                local artisans, and renowned brands worldwide. Every item in our catalog is chosen with our 
                members' discerning tastes in mind.
              </p>
            </div>
            <div>
              <p>
                What sets us apart is our commitment to exclusivity. Our membership model allows us to offer 
                personalized service, competitive pricing, and access to products you won't find in traditional 
                grocery stores. We're not just a grocery store – we're your personal food concierge.
              </p>
              <p className="mt-8">
                Today, we proudly serve over 3,000 members who appreciate the finer things in life and expect 
                nothing less than excellence in their grocery shopping experience.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Image section */}
      <div className="mt-32 sm:mt-40 xl:mx-auto xl:max-w-7xl xl:px-8">
        <img
          src="/images/about-hero.jpg"
          alt="Our premium grocery warehouse"
          className="aspect-[5/2] w-full object-cover xl:rounded-3xl"
        />
      </div>

      {/* Values section */}
      <div className="mx-auto mt-32 max-w-7xl px-6 sm:mt-40 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Our values</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            These core principles guide everything we do and shape the experience we create for our members.
          </p>
        </div>
        <dl className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 text-base leading-7 text-gray-600 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:gap-x-16">
          {values.map((value) => (
            <div key={value.name}>
              <dt className="inline font-semibold text-gray-900">{value.name}.</dt>{' '}
              <dd className="inline">{value.description}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Team section */}
      <div className="mx-auto mt-32 max-w-7xl px-6 sm:mt-48 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Our team</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Meet the passionate individuals who work tirelessly to bring you the best grocery shopping experience.
          </p>
        </div>
        <ul
          role="list"
          className="mx-auto mt-20 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3"
        >
          {team.map((person) => (
            <li key={person.name}>
              <div className="aspect-[3/2] w-full rounded-2xl bg-gray-100">
                {/* Placeholder for team member image */}
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="mt-6 text-lg font-semibold leading-8 tracking-tight text-gray-900">
                {person.name}
              </h3>
              <p className="text-base leading-7 text-gray-600">{person.role}</p>
              <p className="mt-4 text-base leading-7 text-gray-600">{person.bio}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA section */}
      <div className="relative isolate mt-32 px-6 py-32 sm:mt-56 sm:py-40 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Ready to join our community?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600">
            Experience the difference of premium grocery shopping. Apply for membership today and discover 
            what makes us special.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/register"
              className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Apply for membership
            </Link>
            <Link href="/contact" className="text-sm font-semibold leading-6 text-gray-900">
              Contact us <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}